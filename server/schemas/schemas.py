"""
Pydantic v2 Schemas for request/response serialization & validation.
Rejects any raw 13-19 digit credit card numbers to prevent storing sensitive PANs.
"""
from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal
import re
from pydantic import BaseModel, EmailStr, Field, field_validator

# --- Auth Schemas ---
def validate_email_str(v: str) -> str:
    clean = v.strip().lower()
    if not clean or "@" not in clean:
        raise ValueError("Please provide a valid email address.")
    parts = clean.split("@")
    if len(parts) != 2 or not parts[0] or not parts[1] or "." not in parts[1]:
        raise ValueError("Please provide a valid email address with a domain (e.g. user@example.com).")
    return clean

class UserRegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str
    password: str = Field(min_length=8)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 2:
            raise ValueError("Full name must be at least 2 characters long.")
        return clean

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return validate_email_str(v)

    @field_validator("password")
    @classmethod
    def validate_password_not_blank(cls, v: str) -> str:
        if not v or len(v.strip()) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return v

class UserLoginRequest(BaseModel):
    email: str
    password: str
    remember_device: bool = False

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return validate_email_str(v)

    @field_validator("password")
    @classmethod
    def check_password_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Please enter your password.")
        return v

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class TwoFactorRequiredResponse(BaseModel):
    two_factor_required: bool = True
    mfa_token: str
    message: str = "Please provide your 6-digit TOTP code or an 8-character recovery code."

class TwoFactorVerifyRequest(BaseModel):
    mfa_token: str
    code: str  # 6-digit TOTP code or recovery code
    remember_device: bool = False

class StepUpVerifyRequest(BaseModel):
    code: str

class TwoFactorSetupResponse(BaseModel):
    secret: str
    qr_svg: str
    provisioning_uri: str

class TwoFactorEnableRequest(BaseModel):
    secret: str
    code: str

class TwoFactorEnableResponse(BaseModel):
    message: str
    recovery_codes: List[str]

class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return validate_email_str(v)

class ForgotPasswordResponse(BaseModel):
    success: bool = True
    message: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_new_pwd(cls, v: str) -> str:
        if not v or len(v.strip()) < 8:
            raise ValueError("New password must be at least 8 characters long.")
        return v

class ResetPasswordResponse(BaseModel):
    success: bool = True
    message: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    two_factor_enabled: bool
    currency: str
    theme: str
    privacy_mode: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Card & Anti-PAN Validation ---
def check_no_raw_pan(value: Optional[str]) -> Optional[str]:
    if value and re.search(r"\b(?:\d[ -]*?){13,19}\b", value):
        raise ValueError("Security violation: Full 13-19 digit credit card numbers must NEVER be stored or entered.")
    return value

# --- Expense & Income Schemas ---
class ExpenseCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    category_id: str
    date: date
    payment_method: str  # Cash, UPI, Debit Card, Credit Card, Net Banking, Wallet
    note: Optional[str] = None
    tags: List[str] = []
    card_id: Optional[str] = None
    person_id: Optional[str] = None
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None

    @field_validator("note")
    def validate_note(cls, v):
        return check_no_raw_pan(v)

class ExpenseResponse(BaseModel):
    id: str
    amount: Decimal
    category_id: str
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    date: date
    payment_method: str
    note: Optional[str] = None
    tags: List[str] = []
    card_id: Optional[str] = None
    person_id: Optional[str] = None
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None
    created_at: datetime

class IncomeCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    source: str
    date: date
    note: Optional[str] = None
    tags: List[str] = []
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None

    @field_validator("note")
    def validate_note(cls, v):
        return check_no_raw_pan(v)

class IncomeResponse(BaseModel):
    id: str
    amount: Decimal
    source: str
    date: date
    note: Optional[str] = None
    tags: List[str] = []
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None
    created_at: datetime

# --- Categories & Tags ---
class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    icon: str = "tag"
    color: str = "#6366F1"
    monthly_budget: Optional[Decimal] = None

class CategoryResponse(BaseModel):
    id: str
    name: str
    icon: str
    color: str
    monthly_budget: Optional[Decimal] = None

class TagResponse(BaseModel):
    id: str
    name: str
    color: str

# --- Credit Cards & EMI ---
class CreditCardCreate(BaseModel):
    nickname: str
    issuer: str
    last4: str = Field(min_length=4, max_length=4)
    credit_limit: Decimal = Field(gt=0)
    statement_day: int = Field(ge=1, le=31)
    payment_due_day: int = Field(ge=1, le=31)
    interest_rate: Optional[Decimal] = None
    color: str = "#1E293B"

    @field_validator("last4")
    def validate_last4(cls, v):
        if not v.isdigit() or len(v) != 4:
            raise ValueError("Must provide exactly the last 4 digits of the card.")
        return v

class CardPaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    payment_date: date
    payment_source: str = "Bank Account"
    note: Optional[str] = None

class CreditCardUpdate(BaseModel):
    nickname: Optional[str] = None
    issuer: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    statement_day: Optional[int] = None
    payment_due_day: Optional[int] = None
    interest_rate: Optional[Decimal] = None
    color: Optional[str] = None
    is_closed: Optional[bool] = None

class CreditCardResponse(BaseModel):
    id: str
    nickname: str
    issuer: str
    last4: str
    credit_limit: Decimal
    statement_day: int
    payment_due_day: int
    interest_rate: Optional[Decimal] = None
    color: str
    is_closed: bool = False
    current_outstanding: Decimal
    available_credit: Decimal
    utilization_percentage: Decimal

# --- People Ledger ---
class PersonCreate(BaseModel):
    name: str = Field(min_length=1)
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    notes: Optional[str] = None
    avatar_color: str = "#10B981"

class LedgerEntryCreate(BaseModel):
    type: str  # lent, borrowed, settlement
    amount: Decimal = Field(gt=0)
    date: date
    note: Optional[str] = None
    due_date: Optional[date] = None

class PersonResponse(BaseModel):
    id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    avatar_color: str
    net_balance: Decimal  # Positive = they owe me, Negative = I owe them
    is_settled: bool

# --- Investments ---
class InvestmentCreate(BaseModel):
    symbol: str
    name: str
    asset_type: str  # Stock, ETF, Mutual Fund, Crypto, Gold, Fixed Deposit, Other
    notes: Optional[str] = None

class InvestmentTransactionCreate(BaseModel):
    investment_id: str
    type: str  # BUY, SELL, DIVIDEND, SPLIT
    quantity: Decimal
    price: Decimal
    fees: Decimal = Decimal("0.00")
    date: date
    notes: Optional[str] = None

class HoldingResponse(BaseModel):
    investment_id: str
    symbol: str
    name: str
    asset_type: str
    quantity: Decimal
    avg_buy_price: Decimal
    invested_amount: Decimal
    current_price: Decimal
    current_value: Decimal
    unrealized_pnl: Decimal
    unrealized_pnl_pct: Decimal
    realized_pnl: Decimal
    day_change_pct: Decimal

# --- Reports ---
class MonthlyReportResponse(BaseModel):
    month: int
    year: int
    total_income: Decimal
    total_expense: Decimal
    net_savings: Decimal
    savings_rate: Decimal
    category_breakdown: List[dict]
    top_expenses: List[dict]
    daily_spending: List[dict]
    credit_card_spend: Decimal
    investment_contributions: Decimal
    people_ledger_net: Decimal

# --- Bank Accounts & Wallets (Phase 1) ---
class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: str  # Savings, Current, Cash, Wallet, Credit Card, Investment cash, Other
    opening_balance: Decimal = Decimal("0.00")
    currency: str = "USD"
    color: str = "#4F46E5"
    reconciliation_date: Optional[date] = None

class AccountResponse(BaseModel):
    id: str
    name: str
    type: str
    opening_balance: Decimal
    current_balance: Decimal
    currency: str
    color: str
    is_archived: bool
    reconciliation_date: Optional[date] = None
    last_reconciled_balance: Optional[Decimal] = None

class TransferCreate(BaseModel):
    from_account_id: str
    to_account_id: str
    amount: Decimal = Field(gt=0)
    fee: Decimal = Decimal("0.00")
    date: date
    note: Optional[str] = None

class TransferResponse(BaseModel):
    id: str
    from_account_id: str
    to_account_id: str
    from_account_name: Optional[str] = None
    to_account_name: Optional[str] = None
    amount: Decimal
    fee: Decimal
    date: date
    note: Optional[str] = None

class ReconcileRequest(BaseModel):
    statement_balance: Decimal
    reconciled_date: Optional[date] = None
