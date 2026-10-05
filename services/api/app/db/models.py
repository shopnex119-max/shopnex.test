from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Company(Base):
    __tablename__ = "companies"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    vat_number: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    currency: Mapped[str] = mapped_column(String(3), default="SAR", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    username: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    role: Mapped[str] = mapped_column(String(60), nullable=False, default="Company Admin")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Product(Base):
    __tablename__ = "products"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    sku: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(240), nullable=False)
    category: Mapped[str] = mapped_column(String(120), default="عام")
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("15.00"))
    price_includes_vat: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False, default=Decimal("0"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (UniqueConstraint("company_id", "sku", name="uq_products_company_sku"),)


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    invoice_number: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    customer_name: Mapped[str] = mapped_column(String(240), default="عميل نقدي")
    invoice_type: Mapped[str] = mapped_column(String(40), default="simplified")
    status: Mapped[str] = mapped_column(String(40), default="draft")
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    discount_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    taxable_subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    vat_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    change_due: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), default="SAR")
    zatca_uuid: Mapped[str | None] = mapped_column(String(36), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (UniqueConstraint("company_id", "invoice_number", name="uq_invoice_company_number"),)


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    description: Mapped[str] = mapped_column(String(240), nullable=False)
    sku: Mapped[str] = mapped_column(String(80), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    discount_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    price_includes_vat: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class InvoicePayment(Base):
    __tablename__ = "invoice_payments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    method: Mapped[str] = mapped_column(String(24), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    movement_type: Mapped[str] = mapped_column(String(32), nullable=False)
    quantity_change: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ZatcaSettings(Base):
    __tablename__ = "zatca_settings"
    __table_args__ = (UniqueConstraint("company_id", "environment", name="uq_zatca_company_environment"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    environment: Mapped[str] = mapped_column(String(20), nullable=False, default="sandbox")
    company_name: Mapped[str] = mapped_column(String(200), default="")
    vat_number: Mapped[str] = mapped_column(String(20), default="")
    egs_unit: Mapped[str] = mapped_column(String(120), default="")
    certificate_path: Mapped[str] = mapped_column(Text, default="")
    private_key_path: Mapped[str] = mapped_column(Text, default="")
    configured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    last_validation: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ZatcaDocument(Base):
    __tablename__ = "zatca_documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    invoice_id: Mapped[str | None] = mapped_column(ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, default=lambda: str(uuid4()))
    invoice_number: Mapped[str] = mapped_column(String(80), nullable=False)
    invoice_type: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    clearance_status: Mapped[str] = mapped_column(String(32), default="not_applicable")
    reporting_status: Mapped[str] = mapped_column(String(32), default="not_submitted")
    request_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    xml_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    previous_invoice_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    qr_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ModuleRecord(Base):
    __tablename__ = "module_records"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    module: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
