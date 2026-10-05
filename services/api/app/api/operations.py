from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.zatca import DEFAULT_COMPANY_ID, _company
from app.core.auth import require_user
from app.db.models import Invoice, Product, User
from app.db.session import get_db
from app.schemas import InvoiceInput, InvoiceOutput, ProductInput, ProductOutput

router = APIRouter(tags=["Products & Sales"], dependencies=[Depends(require_user)])
CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


@router.get("/products", response_model=list[ProductOutput])
def list_products(db: Session = Depends(get_db), _user: User = Depends(require_user)):
    _company(db)
    return db.scalars(select(Product).where(Product.company_id == DEFAULT_COMPANY_ID, Product.active.is_(True)).order_by(Product.name)).all()


@router.post("/products", response_model=ProductOutput, status_code=201)
def create_product(payload: ProductInput, db: Session = Depends(get_db), _user: User = Depends(require_user)):
    _company(db)
    product = Product(company_id=DEFAULT_COMPANY_ID, **payload.model_dump())
    db.add(product)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="SKU already exists for this company") from exc
    db.refresh(product)
    return product


@router.get("/invoices", response_model=list[InvoiceOutput])
def list_invoices(db: Session = Depends(get_db), _user: User = Depends(require_user)):
    _company(db)
    return db.scalars(select(Invoice).where(Invoice.company_id == DEFAULT_COMPANY_ID).order_by(Invoice.created_at.desc()).limit(200)).all()


@router.post("/invoices", response_model=InvoiceOutput, status_code=201)
def create_invoice(payload: InvoiceInput, db: Session = Depends(get_db), _user: User = Depends(require_user)):
    _company(db)
    subtotal = Decimal("0")
    tax_total = Decimal("0")
    for line in payload.lines:
        net = money(line.quantity * line.unit_price)
        subtotal += net
        tax_total += money(net * line.vat_rate / Decimal("100"))
    subtotal, tax_total = money(subtotal), money(tax_total)
    invoice = Invoice(company_id=DEFAULT_COMPANY_ID, invoice_number=payload.invoice_number, customer_name=payload.customer_name,
                      invoice_type=payload.invoice_type, status="draft", subtotal=subtotal, vat_total=tax_total,
                      total=money(subtotal + tax_total), currency="SAR")
    db.add(invoice)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Invoice number already exists") from exc
    db.refresh(invoice)
    return invoice
