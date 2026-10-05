from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models import Base, InventoryMovement, InvoicePayment
from app.db.session import get_db
from app.main import app


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.state.test_session_maker = TestingSession
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    del app.state.test_session_maker
    Base.metadata.drop_all(engine)
    engine.dispose()


def owner_token(client: TestClient) -> str:
    result = client.post("/api/v1/auth/setup", json={
        "username": "owner", "display_name": "مدير المنشأة", "password": "strong-local-password-2026",
    })
    assert result.status_code == 201, result.text
    return result.json()["access_token"]


def test_setup_is_single_use_and_business_data_requires_session(client: TestClient):
    assert client.get("/api/v1/auth/status").json()["setup_required"] is True
    assert client.get("/api/v1/products").status_code == 401
    owner_token(client)
    assert client.post("/api/v1/auth/login", json={
        "username": "owner", "password": "strong-local-password-2026",
    }).status_code == 200
    assert client.post("/api/v1/auth/login", json={
        "username": "owner", "password": "incorrect-local-password-2026",
    }).status_code == 401
    assert client.get("/api/v1/auth/status").json()["initialized"] is True
    assert client.post("/api/v1/auth/setup", json={
        "username": "other", "display_name": "Other", "password": "another-strong-password-2026",
    }).status_code == 409
    assert client.get("/api/v1/products").status_code == 401


def test_invoice_and_zatca_sensitive_routes_require_authenticated_session(client: TestClient):
    assert client.get("/api/v1/invoices").status_code == 401
    assert client.get("/api/v1/zatca/config").status_code == 401
    assert client.get("/api/v1/zatca/invoices/not-a-real-id/qr/phase1").status_code == 401


def test_product_creation_and_invoice_vat_rounding(client: TestClient):
    token = owner_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    product = client.post("/api/v1/products", headers=headers, json={
        "sku": "SKU-100", "name": "صنف اختباري", "category": "عام", "price": "100.00", "vat_rate": "15.00", "quantity": "4.000",
    })
    assert product.status_code == 201, product.text
    assert product.json()["sku"] == "SKU-100"
    invoice = client.post("/api/v1/invoices", headers=headers, json={
        "invoice_number": "INV-TEST-001", "customer_name": "عميل الاختبار", "invoice_type": "simplified",
        "lines": [{"product_id": product.json()["id"], "quantity": "2", "discount_percent": "0"}],
        "payments": [{"method": "cash", "amount": "250.00"}],
    })
    assert invoice.status_code == 201, invoice.text
    assert Decimal(invoice.json()["subtotal"]) == Decimal("200.00")
    assert Decimal(invoice.json()["vat_total"]) == Decimal("30.00")
    assert Decimal(invoice.json()["total"]) == Decimal("230.00")
    assert invoice.json()["status"] == "paid"
    assert Decimal(invoice.json()["change_due"]) == Decimal("20.00")
    assert Decimal(client.get("/api/v1/products", headers=headers).json()[0]["quantity"]) == Decimal("2.000")
    saved_invoices = client.get("/api/v1/invoices", headers=headers).json()
    assert len(saved_invoices) == 1
    assert saved_invoices[0]["created_at"]
    with app.state.test_session_maker() as db:
        movement = db.scalar(select(InventoryMovement).where(InventoryMovement.invoice_id == invoice.json()["id"]))
        assert movement.user_id
        assert movement.movement_type == "pos_sale"
        assert movement.quantity_change == Decimal("-2.000")
        assert movement.balance_after == Decimal("2.000")
        payment = db.scalar(select(InvoicePayment).where(InvoicePayment.invoice_id == invoice.json()["id"]))
        assert payment.amount == Decimal("230.00")
    trial = client.get("/api/v1/accounting/trial-balance", headers=headers)
    assert trial.status_code == 200 and trial.json()["balanced"] is True
    report = client.get("/api/v1/reports/overview", headers=headers)
    assert report.status_code == 200
    assert Decimal(str(report.json()["sales"]["total"])) == Decimal("230.00")
    assert report.json()["period"]["timezone"] == "Asia/Riyadh"


def test_invoice_price_and_tax_come_from_catalog_and_inclusive_prices_round_safely(client: TestClient):
    headers = {"Authorization": f"Bearer {owner_token(client)}"}
    product = client.post("/api/v1/products", headers=headers, json={
        "sku": "SKU-INCLUSIVE", "name": "سعر شامل", "price": "115.00", "vat_rate": "15.00",
        "quantity": "3.000", "price_includes_vat": True,
    })
    assert product.status_code == 201, product.text
    invoice = client.post("/api/v1/invoices", headers=headers, json={
        "invoice_number": "INV-INCLUSIVE-001",
        "lines": [{"product_id": product.json()["id"], "quantity": "1", "unit_price": "0.01", "vat_rate": "0"}],
    })
    assert invoice.status_code == 201, invoice.text
    assert Decimal(invoice.json()["subtotal"]) == Decimal("115.00")
    assert Decimal(invoice.json()["taxable_subtotal"]) == Decimal("100.00")
    assert Decimal(invoice.json()["vat_total"]) == Decimal("15.00")
    assert Decimal(invoice.json()["total"]) == Decimal("115.00")


def test_invoice_rejects_oversell_without_creating_invoice(client: TestClient):
    headers = {"Authorization": f"Bearer {owner_token(client)}"}
    product = client.post("/api/v1/products", headers=headers, json={
        "sku": "SKU-LOW", "name": "مخزون قليل", "price": "10.00", "quantity": "1.000",
    })
    response = client.post("/api/v1/invoices", headers=headers, json={
        "invoice_number": "INV-OVERSALE", "lines": [{"product_id": product.json()["id"], "quantity": "2"}],
    })
    assert response.status_code == 409
    assert client.get("/api/v1/invoices", headers=headers).json() == []


def test_zatca_config_is_local_and_external_connection_is_explicitly_disabled(client: TestClient):
    headers = {"Authorization": f"Bearer {owner_token(client)}"}
    saved = client.put("/api/v1/zatca/config", headers=headers, json={
        "environment": "sandbox", "company_name": "شركة اختبار", "vat_number": "310000000000003", "egs_unit": "EGS-LOCAL-001",
    })
    assert saved.status_code == 200, saved.text
    result = saved.json()
    assert result["configured"] is True
    assert result["adapter_ready"] is False
    assert "api_credential" not in result
    assert client.post("/api/v1/zatca/validate?environment=sandbox", headers=headers).json()["authority_contacted"] is False
    blocked = client.post("/api/v1/zatca/test-connection", headers=headers)
    assert blocked.status_code == 501
    assert "No authority request was sent" in blocked.json()["detail"]
