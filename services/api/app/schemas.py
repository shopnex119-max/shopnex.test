from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ZatcaConfigInput(BaseModel):
    environment: str = "sandbox"
    company_name: str = Field(default="", max_length=200)
    vat_number: str = Field(default="", max_length=20)
    egs_unit: str = Field(default="", max_length=120)
    certificate_path: str = Field(default="", max_length=1024)
    private_key_path: str = Field(default="", max_length=1024)
    api_credential: str | None = Field(default=None, max_length=16384)

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, value: str) -> str:
        normalized = value.lower().strip()
        if normalized not in {"sandbox", "production"}:
            raise ValueError("environment must be sandbox or production")
        return normalized


class ZatcaConfigOutput(BaseModel):
    configured: bool
    environment: str
    company_name: str
    vat_number: str
    egs_unit: str
    certificate_path: str = ""
    private_key_path: str = ""
    secret_present: bool = False
    certificate_present: bool = False
    private_key_present: bool = False
    adapter_ready: bool = False
    last_validation: str | None = None


class ProductInput(BaseModel):
    sku: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=240)
    category: str = Field(default="عام", max_length=120)
    price: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    vat_rate: Decimal = Field(default=Decimal("15.00"), ge=0, le=100, max_digits=5, decimal_places=2)
    quantity: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=3)
    price_includes_vat: bool = False


class ProductOutput(ProductInput):
    model_config = ConfigDict(from_attributes=True)
    id: str
    active: bool


class InvoiceLineInput(BaseModel):
    product_id: str = Field(min_length=1, max_length=36)
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    discount_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100, max_digits=5, decimal_places=2)


class InvoicePaymentInput(BaseModel):
    method: str = Field(pattern="^(cash|card|bank_transfer|wallet|other)$")
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)


class InvoiceInput(BaseModel):
    invoice_number: str = Field(min_length=1, max_length=80)
    customer_name: str = Field(default="عميل نقدي", max_length=240)
    invoice_type: str = Field(default="simplified", pattern="^(simplified|tax|credit_note|debit_note)$")
    lines: list[InvoiceLineInput] = Field(min_length=1, max_length=500)
    payments: list[InvoicePaymentInput] = Field(default_factory=list, max_length=20)


class InvoiceOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    invoice_number: str
    customer_name: str
    invoice_type: str
    status: str
    subtotal: Decimal
    discount_total: Decimal
    taxable_subtotal: Decimal
    vat_total: Decimal
    total: Decimal
    amount_paid: Decimal
    change_due: Decimal
    currency: str
    created_at: datetime
