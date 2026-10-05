from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.zatca import DEFAULT_COMPANY_ID, _company
from app.core.auth import require_user
from app.db.models import InventoryMovement, Invoice, InvoiceLine, InvoicePayment, Product, User
from app.db.session import get_db
from app.financial import ZERO, calculate_line, money
from app.schemas import InvoiceInput, InvoiceOutput, ProductInput, ProductOutput

router = APIRouter(tags=["Products & Sales"], dependencies=[Depends(require_user)])


@router.get("/products", response_model=list[ProductOutput])
def list_products(db: Session = Depends(get_db), _user: User = Depends(require_user)):
    _company(db)
    return db.scalars(
        select(Product)
        .where(Product.company_id == DEFAULT_COMPANY_ID, Product.active.is_(True))
        .order_by(Product.name)
    ).all()


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
    return db.scalars(
        select(Invoice)
        .where(Invoice.company_id == DEFAULT_COMPANY_ID)
        .order_by(Invoice.created_at.desc())
        .limit(200)
    ).all()


@router.post("/invoices", response_model=InvoiceOutput, status_code=201)
def create_invoice(payload: InvoiceInput, db: Session = Depends(get_db), user: User = Depends(require_user)):
    """Create a sale from catalog product IDs; server owns all price/tax arithmetic."""
    _company(db)
    subtotal = ZERO
    discount_total = ZERO
    taxable_subtotal = ZERO
    vat_total = ZERO
    grand_total = ZERO
    prepared_lines: list[tuple[Product, object, object]] = []

    try:
        for line in payload.lines:
            product = db.scalar(
                select(Product)
                .where(
                    Product.id == line.product_id,
                    Product.company_id == DEFAULT_COMPANY_ID,
                    Product.active.is_(True),
                )
                .with_for_update()
            )
            if product is None:
                raise HTTPException(status_code=404, detail=f"Product not found: {line.product_id}")
            if product.quantity < line.quantity:
                raise HTTPException(status_code=409, detail=f"Insufficient stock for {product.name}")

            totals = calculate_line(
                quantity=line.quantity,
                unit_price=product.price,
                vat_rate=product.vat_rate,
                discount_percent=line.discount_percent,
                price_includes_vat=product.price_includes_vat,
            )
            subtotal += totals.gross_amount
            discount_total += totals.discount_amount
            taxable_subtotal += totals.taxable_amount
            vat_total += totals.vat_amount
            grand_total += totals.total_amount
            product.quantity -= line.quantity
            prepared_lines.append((product, line, totals))

        subtotal = money(subtotal)
        discount_total = money(discount_total)
        taxable_subtotal = money(taxable_subtotal)
        vat_total = money(vat_total)
        grand_total = money(grand_total)
        tendered = money(sum((payment.amount for payment in payload.payments), ZERO))
        change_due = money(max(ZERO, tendered - grand_total))
        if change_due and any(payment.method != "cash" for payment in payload.payments):
            raise HTTPException(status_code=422, detail="Overpayment is only allowed for cash payments")
        amount_paid = min(tendered, grand_total)
        status = "paid" if amount_paid >= grand_total else "partially_paid" if amount_paid > ZERO else "draft"

        invoice = Invoice(
            company_id=DEFAULT_COMPANY_ID,
            invoice_number=payload.invoice_number,
            customer_name=payload.customer_name,
            invoice_type=payload.invoice_type,
            status=status,
            subtotal=subtotal,
            discount_total=discount_total,
            taxable_subtotal=taxable_subtotal,
            vat_total=vat_total,
            total=grand_total,
            amount_paid=amount_paid,
            change_due=change_due,
            currency="SAR",
        )
        db.add(invoice)
        db.flush()

        for product, line, totals in prepared_lines:
            db.add(InvoiceLine(
                invoice_id=invoice.id,
                product_id=product.id,
                description=product.name,
                sku=product.sku,
                quantity=line.quantity,
                unit_price=product.price,
                discount_percent=line.discount_percent,
                discount_amount=totals.discount_amount,
                taxable_amount=totals.taxable_amount,
                vat_rate=product.vat_rate,
                vat_amount=totals.vat_amount,
                total_amount=totals.total_amount,
                price_includes_vat=product.price_includes_vat,
            ))
            db.add(InventoryMovement(
                company_id=DEFAULT_COMPANY_ID,
                product_id=product.id,
                invoice_id=invoice.id,
                user_id=user.id,
                movement_type="pos_sale",
                quantity_change=-line.quantity,
                balance_after=product.quantity,
            ))
        unapplied_amount = amount_paid
        for payment in payload.payments:
            applied_amount = min(payment.amount, unapplied_amount)
            unapplied_amount -= applied_amount
            if applied_amount > ZERO:
                db.add(InvoicePayment(invoice_id=invoice.id, method=payment.method, amount=money(applied_amount)))

        db.commit()
        db.refresh(invoice)
        return invoice
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Invoice number already exists") from exc
    except HTTPException:
        db.rollback()
        raise
