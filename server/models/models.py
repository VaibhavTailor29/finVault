"""
SQLAlchemy 2.0 Database Models with UUID primary keys and timestamps.
Includes Phase 1-6 models: Accounts, Transfers, ImportBatch, Rules, Goals, Subscriptions,
Snapshots, Splits, Attachments, Tax, SIPs, SMS Inbox, Households, and Auditing.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import (
    Column, String, Boolean, Integer, Float, DateTime, Date, ForeignKey, 
    Index, Text, Table, Numeric
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

# Association tables
expense_tags = Table(
    "expense_tags",
    Base.metadata,
    Column("expense_id", String(36), ForeignKey("expenses.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", String(36), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
)

income_tags = Table(
    "income_tags",
    Base.metadata,
    Column("income_id", String(36), ForeignKey("incomes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", String(36), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email_encrypted = Column(Text, nullable=False)
    name_encrypted = Column(Text, nullable=False)
    email_hash = Column(String(64), unique=True, index=True, nullable=False)
    username_hash = Column(String(64), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    two_factor_enabled = Column(Boolean, default=False, nullable=False)
    two_factor_secret_encrypted = Column(Text, nullable=True)
    two_factor_last_used_step = Column(Integer, default=0, nullable=False)
    two_factor_recovery_codes_json = Column(Text, nullable=True)
    
    failed_login_count = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    
    currency = Column(String(10), default="INR", nullable=False)
    theme = Column(String(10), default="system", nullable=False)
    privacy_mode = Column(Boolean, default=False, nullable=False)
    api_key_hash = Column(String(64), nullable=True, index=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="user", cascade="all, delete-orphan")
    incomes = relationship("Income", back_populates="user", cascade="all, delete-orphan")
    transfers = relationship("Transfer", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    tags = relationship("Tag", back_populates="user", cascade="all, delete-orphan")
    credit_cards = relationship("CreditCard", back_populates="user", cascade="all, delete-orphan")
    people = relationship("Person", back_populates="user", cascade="all, delete-orphan")
    investments = relationship("Investment", back_populates="user", cascade="all, delete-orphan")
    goals = relationship("SavingsGoal", back_populates="user", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="user", cascade="all, delete-orphan")
    rules = relationship("AutoRule", back_populates="user", cascade="all, delete-orphan")
    snapshots = relationship("NetWorthSnapshot", back_populates="user", cascade="all, delete-orphan")

class Account(Base):
    """Bank accounts, cash, wallets, and investment cash balances."""
    __tablename__ = "accounts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(30), nullable=False)  # Savings, Current, Cash, Wallet, Credit Card, Investment cash, Other
    opening_balance_encrypted = Column(Text, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    color = Column(String(20), default="#4F46E5", nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    last_reconciled_at = Column(DateTime(timezone=True), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="accounts")

class Transfer(Base):
    """First-class money movements between accounts (strictly excluded from spending)."""
    __tablename__ = "transfers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    from_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    to_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    amount_encrypted = Column(Text, nullable=False)
    date = Column(Date, nullable=False, index=True)
    fee_expense_id = Column(String(36), ForeignKey("expenses.id", ondelete="SET NULL"), nullable=True)
    note_encrypted = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="transfers")

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    amount_encrypted = Column(Text, nullable=False)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    payment_method = Column(String(50), nullable=False)
    note_encrypted = Column(Text, nullable=True)
    card_id = Column(String(36), ForeignKey("credit_cards.id", ondelete="SET NULL"), nullable=True)
    person_id = Column(String(36), ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    import_batch_id = Column(String(36), ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True)
    is_recurring = Column(Boolean, default=False, nullable=False)
    recurring_frequency = Column(String(20), nullable=True)
    is_split = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="expenses")
    category = relationship("Category")
    tags = relationship("Tag", secondary=expense_tags)

class Income(Base):
    __tablename__ = "incomes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    amount_encrypted = Column(Text, nullable=False)
    source = Column(String(50), nullable=False)
    date = Column(Date, nullable=False, index=True)
    note_encrypted = Column(Text, nullable=True)
    import_batch_id = Column(String(36), ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True)
    is_recurring = Column(Boolean, default=False, nullable=False)
    recurring_frequency = Column(String(20), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="incomes")
    tags = relationship("Tag", secondary=income_tags)

class ImportBatch(Base):
    """Statement Import Batches with undo capability."""
    __tablename__ = "import_batches"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_format = Column(String(10), nullable=False)  # CSV, OFX, QIF
    row_count = Column(Integer, default=0, nullable=False)
    is_undone = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class AutoRule(Base):
    """Auto-categorization & tagging rules."""
    __tablename__ = "auto_rules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    priority = Column(Integer, default=0, nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    # Conditions
    match_field = Column(String(30), default="description", nullable=False)  # description, amount, account
    match_type = Column(String(20), default="contains", nullable=False)  # contains, equals, regex
    match_value = Column(String(200), nullable=False)
    # Actions
    action_category_id = Column(String(36), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    action_tags = Column(Text, nullable=True)  # comma separated
    action_mark_transfer = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="rules")

class SavingsGoal(Base):
    """Financial goals & milestone projections."""
    __tablename__ = "savings_goals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    target_amount_encrypted = Column(Text, nullable=False)
    current_amount_encrypted = Column(Text, nullable=False)
    target_date = Column(Date, nullable=False)
    linked_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    color = Column(String(20), default="#10B981", nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="goals")

class Subscription(Base):
    """Detected repeating charges with price-hike alerts."""
    __tablename__ = "subscriptions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    merchant = Column(String(100), nullable=False)
    cadence = Column(String(20), default="Monthly", nullable=False)
    expected_amount_encrypted = Column(Text, nullable=False)
    next_renewal_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="subscriptions")

class NetWorthSnapshot(Base):
    """Historical net worth snapshots."""
    __tablename__ = "net_worth_snapshots"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_date = Column(Date, nullable=False, index=True)
    total_net_worth_encrypted = Column(Text, nullable=False)
    cash_encrypted = Column(Text, nullable=False)
    investments_encrypted = Column(Text, nullable=False)
    liabilities_encrypted = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="snapshots")

class SplitExpense(Base):
    """Expense split among people."""
    __tablename__ = "split_expenses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    expense_id = Column(String(36), ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(String(36), ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    share_amount_encrypted = Column(Text, nullable=False)
    ledger_entry_id = Column(String(36), ForeignKey("ledger_entries.id", ondelete="SET NULL"), nullable=True)

class Attachment(Base):
    """Receipt images and PDF statement attachments with OCR metadata."""
    __tablename__ = "attachments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expense_id = Column(String(36), ForeignKey("expenses.id", ondelete="SET NULL"), nullable=True)
    file_path = Column(String(255), nullable=False)
    content_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=False)
    ocr_extracted_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class SIPSchedule(Base):
    """Mutual Fund Systematic Investment Plan schedule."""
    __tablename__ = "sip_schedules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    fund_name = Column(String(200), nullable=False)
    scheme_code = Column(String(50), nullable=True)
    amount_encrypted = Column(Text, nullable=False)
    sip_day = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class SMSInbox(Base):
    """Bank/UPI SMS ingest inbox pending review."""
    __tablename__ = "sms_inbox"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    raw_message = Column(Text, nullable=False)
    sender = Column(String(50), nullable=False)
    parsed_amount_encrypted = Column(Text, nullable=True)
    parsed_merchant = Column(String(100), nullable=True)
    parsed_date = Column(Date, nullable=True)
    status = Column(String(20), default="pending", nullable=False)  # pending, accepted, dismissed
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class Household(Base):
    """Shared household accounts with multi-tenant isolation."""
    __tablename__ = "households"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class HouseholdMember(Base):
    __tablename__ = "household_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    household_id = Column(String(36), ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), default="viewer", nullable=False)  # owner, editor, viewer
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

# Retain existing models from Phase 1
class Category(Base):
    __tablename__ = "categories"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    icon = Column(String(50), default="tag", nullable=False)
    color = Column(String(20), default="#6366F1", nullable=False)
    budget_amount_encrypted = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    user = relationship("User", back_populates="categories")

class Tag(Base):
    __tablename__ = "tags"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    color = Column(String(20), default="#94A3B8", nullable=False)
    user = relationship("User", back_populates="tags")

class Budget(Base):
    __tablename__ = "budgets"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    overall_amount_encrypted = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class CreditCard(Base):
    __tablename__ = "credit_cards"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    nickname = Column(String(100), nullable=False)
    issuer = Column(String(100), nullable=False)
    last4_encrypted = Column(Text, nullable=False)
    credit_limit_encrypted = Column(Text, nullable=False)
    statement_day = Column(Integer, nullable=False)
    payment_due_day = Column(Integer, nullable=False)
    interest_rate_encrypted = Column(Text, nullable=True)
    color = Column(String(30), default="#1E293B", nullable=False)
    network = Column(String(30), default="visa", nullable=True)
    is_closed = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    user = relationship("User", back_populates="credit_cards")

class CardPayment(Base):
    __tablename__ = "card_payments"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    card_id = Column(String(36), ForeignKey("credit_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    amount_encrypted = Column(Text, nullable=False)
    payment_date = Column(Date, nullable=False)
    payment_source = Column(String(50), default="Bank Account", nullable=False)
    note_encrypted = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class CardEMI(Base):
    __tablename__ = "card_emis"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    card_id = Column(String(36), ForeignKey("credit_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(100), nullable=False)
    principal_encrypted = Column(Text, nullable=False)
    tenure_months = Column(Integer, nullable=False)
    installment_encrypted = Column(Text, nullable=False)
    remaining_installments = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=False)

class Person(Base):
    __tablename__ = "people"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name_encrypted = Column(Text, nullable=False)
    phone_encrypted = Column(Text, nullable=True)
    email_encrypted = Column(Text, nullable=True)
    notes_encrypted = Column(Text, nullable=True)
    avatar_color = Column(String(20), default="#10B981", nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    user = relationship("User", back_populates="people")

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    person_id = Column(String(36), ForeignKey("people.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(20), nullable=False)
    amount_encrypted = Column(Text, nullable=False)
    date = Column(Date, nullable=False)
    note_encrypted = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True)
    is_settled = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class Investment(Base):
    __tablename__ = "investments"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    asset_type = Column(String(30), nullable=False)
    tax_section = Column(String(20), nullable=True)  # 80C, 80D, etc.
    notes_encrypted = Column(Text, nullable=True)
    institution = Column(String(100), nullable=True)
    interest_rate = Column(Float, nullable=True)
    maturity_date = Column(String(30), nullable=True)
    tenure_years = Column(Float, nullable=True)
    compounding_frequency = Column(String(30), nullable=True)
    monthly_deposit = Column(Float, nullable=True)
    sip_day = Column(Integer, nullable=True)
    payout_frequency = Column(String(30), nullable=True)
    credit_rating = Column(String(30), nullable=True)
    category_tag = Column(String(50), nullable=True)
    units_or_grams = Column(Float, nullable=True)
    is_sip_active = Column(Boolean, default=True, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    user = relationship("User", back_populates="investments")

class InvestmentTransaction(Base):
    __tablename__ = "investment_transactions"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    investment_id = Column(String(36), ForeignKey("investments.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(20), nullable=False)
    quantity_encrypted = Column(Text, nullable=False)
    price_encrypted = Column(Text, nullable=False)
    fees_encrypted = Column(Text, default="", nullable=True)
    date = Column(Date, nullable=False)
    notes_encrypted = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class PriceCache(Base):
    __tablename__ = "price_cache"
    symbol = Column(String(30), primary_key=True)
    price = Column(Text, nullable=False)
    day_change = Column(Text, default="0.00", nullable=False)
    last_updated = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(30), nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    entity = Column(String(50), nullable=False)
    action = Column(String(30), nullable=False)  # CREATE, UPDATE, DELETE, RESTORE
    fields_changed = Column(Text, nullable=True)  # JSON list of field names (never sensitive values)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
