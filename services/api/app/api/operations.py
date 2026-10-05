from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounting import post_journal
from app.api.zatca import _company
from app.core.auth import require_user
from app.db.models import InventoryMovement, Invoice, InvoiceLine, InvoicePayment, Product, User
from app.db.session import get_db
from app.financial import ZERO, calculate_line, money
from app.schemas import InvoiceInput, InvoiceOutput, ProductInput, ProductOutput
from app.tax import resolve_tax_rule

router = APIRouter(tags=["Products & Sales"], dependencies=[Depends(require_user)])


@router.get("/products", response_model=list[ProductOutput])
def list_products(db: Session = Depends(get_db), _user: User = Depends(require_user)):
    company = _company(db)
    return db.scalars(
        select(Product)
        .where(Product.company_id == company.id, Product.active.is_(True))
        .order_by(Product.name)
    ).all()


@router.post("/products", response_model=ProductOutput, status_code=201)
def create_product(payload: ProductInput, db: Session = Depends(get_db), _user: User = Depends(require_user)):
    company = _company(db)
    tax_rule = resolve_tax_rule(db, company.id, payload.tax_category, payload.vat_rate, reason=payload.tax_reason)
    product = Product(company_id=company.id, tax_rule_id=tax_rule.id, **payload.model_dump())
    db.add(product)
    try:
        db.flush()
        if product.quantity > ZERO:
            db.add(InventoryMovement(
                company_id=company.id, product_id=product.id, invoice_id=None, purchase_id=None,
                user_id=_user.id, movement_type="opening_balance", quantity_change=product.quantity,
                balance_after=product.quantity,
            ))
            opening_value = money(product.quantity * product.average_cost)
            if opening_value > ZERO:
                post_journal(
                    db, company_id=company.id, user_id=_user.id, source_type="opening_stock",
                    source_id=product.id, description=f"رصيد افتتاحي للمخزون · {product.name}",
                    lines=[("inventory", opening_value, ZERO, product.sku), ("equity", ZERO, opening_value, product.sku)],
                )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="SKU already exists for this company") from exc
    db.refresh(product)
    return product


@router.get("/invoices", response_model=list[InvoiceOutput])
def list_invoices(db: Session = Depends(get_db), _user: User = Depends(require_user)):
    company = _company(db)
    return db.scalars(
        select(Invoice)
        .where(Invoice.company_id == company.id)
        .order_by(Invoice.created_at.desc())
        .limit(200)
    ).all()


@router.post("/invoices", response_model=InvoiceOutput, status_code=201)
def create_invoice(payload: InvoiceInput, db: Session = Depends(get_db), user: User = Depends(require_user)):
    """Create a sale from catalog product IDs; server owns all price/tax arithmetic."""
    company = _company(db)
    subtotal = ZERO
    discount_total = ZERO
    taxable_subtotal = ZERO
    vat_total = ZERO
    grand_total = ZERO
    prepared_lines: list[tuple[Product, object, object, object]] = []

    try:
        for line in payload.lines:
            product = db.scalar(
                select(Product)
                .where(
                    Product.id == line.product_id,
                    Product.company_id == company.id,
                    Product.active.is_(True),
                )
                .with_for_update()
            )
            if product is None:
                raise HTTPException(status_code=404, detail=f"Product not found: {line.product_id}")
            if product.quantity < line.quantity:
                raise HTTPException(status_code=409, detail=f"Insufficient stock for {product.name}")

            tax_rule = resolve_tax_rule(db, company.id, product.tax_category, product.vat_rate, reason=product.tax_reason)
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
            prepared_lines.append((product, line, totals, tax_rule))

        subtotal = money(subtotal)
        discount_total = money(discount_total)
        taxable_subtotal = money(taxable_subtotal)
        vat_total = money(vat_total)
        grand_total = money(grand_total)
        if grand_total <= ZERO:
            raise HTTPException(status_code=422, detail="A sale invoice total must be greater than zero")
        tendered = money(sum((payment.amount for payment in payload.payments), ZERO))
        change_due = money(max(ZERO, tendered - grand_total))
        if change_due and any(payment.method != "cash" for payment in payload.payments):
            raise HTTPException(status_code=422, detail="Overpayment is only allowed for cash payments")
        amount_paid = min(tendered, grand_total)
        status = "paid" if amount_paid >= grand_total else "partially_paid" if amount_paid > ZERO else "unpaid"

        invoice = Invoice(
            company_id=company.id,
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

        cogs_total = ZERO
        for product, line, totals, tax_rule in prepared_lines:
            line_cost = money(product.average_cost * line.quantity)
            cogs_total += line_cost
            db.add(InvoiceLine(
                invoice_id=invoice.id,
                product_id=product.id,
                description=product.name,
                sku=product.sku,
                quantity=line.quantity,
                unit_price=product.price,
                unit_cost=product.average_cost,
                discount_percent=line.discount_percent,
                discount_amount=totals.discount_amount,
                taxable_amount=totals.taxable_amount,
                vat_rate=product.vat_rate,
                tax_category=product.tax_category,
                tax_reason=product.tax_reason,
                tax_rule_code=tax_rule.code,
                tax_rule_version=tax_rule.version,
                vat_amount=totals.vat_amount,
                total_amount=totals.total_amount,
                price_includes_vat=product.price_includes_vat,
            ))
            db.add(InventoryMovement(
                company_id=company.id,
                product_id=product.id,
                invoice_id=invoice.id,
                user_id=user.id,
                movement_type="pos_sale",
                quantity_change=-line.quantity,
                balance_after=product.quantity,
            ))
        unapplied_amount = amount_paid
        paid_by_account = {"cash": ZERO, "bank": ZERO}
        for payment in payload.payments:
            applied_amount = min(payment.amount, unapplied_amount)
            unapplied_amount -= applied_amount
            if applied_amount > ZERO:
                db.add(InvoicePayment(invoice_id=invoice.id, method=payment.method, amount=money(applied_amount)))
                paid_by_account["cash" if payment.method == "cash" else "bank"] += money(applied_amount)

        journal_lines = [
            ("cash", money(paid_by_account["cash"]), ZERO, "مقبوضات نقدية"),
            ("bank", money(paid_by_account["bank"]), ZERO, "مقبوضات شبكة/تحويل"),
            ("receivable", money(grand_total - amount_paid), ZERO, "ذمم عملاء غير محصلة"),
            ("sales", ZERO, taxable_subtotal, f"مبيعات {invoice.invoice_number}"),
            ("vat_output", ZERO, vat_total, "ضريبة مخرجات"),
        ]
        if money(cogs_total) > ZERO:
            journal_lines.extend([
                ("cogs", money(cogs_total), ZERO, f"تكلفة بضاعة {invoice.invoice_number}"),
                ("inventory", ZERO, money(cogs_total), f"تخفيض مخزون {invoice.invoice_number}"),
            ])
        post_journal(
            db, company_id=company.id, user_id=user.id,
            source_type="sale", source_id=invoice.id,
            description=f"فاتورة بيع {invoice.invoice_number}", lines=journal_lines,
        )

        db.commit()
        db.refresh(invoice)
        return invoice
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Invoice number already exists") from exc
    except HTTPException:
        db.rollback()
        raise
