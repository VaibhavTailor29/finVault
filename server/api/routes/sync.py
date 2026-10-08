"""
Full State Synchronization Endpoint.
Fetches all user finance entities from PostgreSQL in a single call.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc

from server.models.models import (
    Account, Transfer, Expense, Income, Category, Budget,
    CreditCard, CardPayment, Person, LedgerEntry, Investment, InvestmentTransaction
)
from server.core.crypto import CryptoService
from server.api.deps import get_current_user_id, get_db

router = APIRouter(prefix="/sync", tags=["Sync"])

@router.get("")
async def sync_all_data(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    # Accounts
    acc_res = await db.execute(select(Account).where(and_(Account.user_id == user_id, Account.is_deleted == False)))
    accounts_db = acc_res.scalars().all()
    accounts = []
    for a in accounts_db:
        bal = CryptoService.decrypt_decimal(a.opening_balance_encrypted, user_id, "accounts", "opening_balance")
        accounts.append({
            "id": a.id,
            "name": a.name,
            "type": a.type,
            "openingBalance": float(bal),
            "currency": a.currency,
            "color": a.color,
            "isArchived": a.is_archived,
            "lastReconciledAt": a.last_reconciled_at.isoformat() if a.last_reconciled_at else None
        })

    # Transfers
    tr_res = await db.execute(select(Transfer).where(and_(Transfer.user_id == user_id, Transfer.is_deleted == False)))
    transfers = []
    for t in tr_res.scalars().all():
        amt = CryptoService.decrypt_decimal(t.amount_encrypted, user_id, "transfers", "amount")
        note = CryptoService.decrypt(t.note_encrypted, user_id, "transfers", "note") if t.note_encrypted else None
        transfers.append({
            "id": t.id,
            "fromAccountId": t.from_account_id,
            "toAccountId": t.to_account_id,
            "amount": float(amt),
            "date": str(t.date),
            "note": note,
            "createdAt": t.created_at.isoformat() if t.created_at else None
        })

    # Categories
    cat_res = await db.execute(select(Category).where(and_(Category.user_id == user_id, Category.is_deleted == False)))
    categories = []
    for c in cat_res.scalars().all():
        b_amt = CryptoService.decrypt_decimal(c.budget_amount_encrypted or "0", user_id, "categories", "budget_amount")
        categories.append({
            "id": c.id,
            "name": c.name,
            "icon": c.icon,
            "color": c.color,
            "monthlyBudget": float(b_amt)
        })

    # Expenses
    exp_res = await db.execute(select(Expense).where(and_(Expense.user_id == user_id, Expense.is_deleted == False)).order_by(desc(Expense.date)))
    expenses = []
    for e in exp_res.scalars().all():
        amt = CryptoService.decrypt_decimal(e.amount_encrypted, user_id, "expenses", "amount")
        note = CryptoService.decrypt(e.note_encrypted, user_id, "expenses", "note") if e.note_encrypted else None
        expenses.append({
            "id": e.id,
            "amount": float(amt),
            "categoryId": e.category_id,
            "date": str(e.date),
            "paymentMethod": e.payment_method,
            "note": note,
            "tags": [],
            "cardId": e.card_id,
            "personId": e.person_id,
            "isRecurring": e.is_recurring,
            "recurringFrequency": e.recurring_frequency,
            "createdAt": e.created_at.isoformat() if e.created_at else None
        })

    # Incomes
    inc_res = await db.execute(select(Income).where(and_(Income.user_id == user_id, Income.is_deleted == False)).order_by(desc(Income.date)))
    incomes = []
    for i in inc_res.scalars().all():
        amt = CryptoService.decrypt_decimal(i.amount_encrypted, user_id, "incomes", "amount")
        note = CryptoService.decrypt(i.note_encrypted, user_id, "incomes", "note") if i.note_encrypted else None
        incomes.append({
            "id": i.id,
            "amount": float(amt),
            "source": i.source,
            "date": str(i.date),
            "note": note,
            "tags": [],
            "isRecurring": i.is_recurring,
            "recurringFrequency": i.recurring_frequency,
            "createdAt": i.created_at.isoformat() if i.created_at else None
        })

    # Budgets
    bud_res = await db.execute(select(Budget).where(Budget.user_id == user_id))
    budgets = []
    for b in bud_res.scalars().all():
        amt = CryptoService.decrypt_decimal(b.overall_amount_encrypted, user_id, "budgets", "overall_amount")
        budgets.append({
            "id": b.id,
            "month": b.month,
            "year": b.year,
            "overallAmount": float(amt)
        })

    # Credit Cards
    card_res = await db.execute(select(CreditCard).where(and_(CreditCard.user_id == user_id, CreditCard.is_deleted == False)))
    credit_cards = []
    for c in card_res.scalars().all():
        limit = CryptoService.decrypt_decimal(c.credit_limit_encrypted, user_id, "credit_cards", "credit_limit")
        last4 = CryptoService.decrypt(c.last4_encrypted, user_id, "credit_cards", "last4") or "XXXX"
        ir = CryptoService.decrypt_decimal(c.interest_rate_encrypted, user_id, "credit_cards", "interest_rate") if c.interest_rate_encrypted else None
        credit_cards.append({
            "id": c.id,
            "nickname": c.nickname,
            "issuer": c.issuer,
            "last4": last4,
            "creditLimit": float(limit),
            "statementDay": c.statement_day,
            "paymentDueDay": c.payment_due_day,
            "interestRate": float(ir) if ir else None,
            "color": c.color,
            "network": getattr(c, "network", "visa") or "visa",
            "isClosed": bool(getattr(c, "is_closed", False)),
        })

    # People
    peop_res = await db.execute(select(Person).where(and_(Person.user_id == user_id, Person.is_deleted == False)))
    people = []
    for p in peop_res.scalars().all():
        name = CryptoService.decrypt(p.name_encrypted, user_id, "people", "name") or "Contact"
        phone = CryptoService.decrypt(p.phone_encrypted, user_id, "people", "phone") if p.phone_encrypted else None
        notes = CryptoService.decrypt(p.notes_encrypted, user_id, "people", "notes") if p.notes_encrypted else None
        email = CryptoService.decrypt(p.email_encrypted, user_id, "people", "email") if p.email_encrypted else None
        people.append({
            "id": p.id,
            "name": name,
            "phone": phone,
            "email": email,
            "notes": notes,
            "avatarColor": p.avatar_color
        })

    # Ledger Entries
    led_res = await db.execute(select(LedgerEntry).where(and_(LedgerEntry.user_id == user_id, LedgerEntry.is_deleted == False)))
    ledger_entries = []
    for l in led_res.scalars().all():
        amt = CryptoService.decrypt_decimal(l.amount_encrypted, user_id, "ledger_entries", "amount")
        note = CryptoService.decrypt(l.note_encrypted, user_id, "ledger_entries", "note") if l.note_encrypted else None
        ledger_entries.append({
            "id": l.id,
            "personId": l.person_id,
            "type": l.type,
            "amount": float(amt),
            "date": str(l.date),
            "note": note,
            "isSettled": l.is_settled,
            "dueDate": str(l.due_date) if l.due_date else None,
            "createdAt": l.created_at.isoformat() if l.created_at else None
        })

    return {
        "accounts": accounts,
        "transfers": transfers,
        "categories": categories,
        "expenses": expenses,
        "incomes": incomes,
        "budgets": budgets,
        "creditCards": credit_cards,
        "people": people,
        "ledgerEntries": ledger_entries,
        "investments": [],
        "investmentTransactions": []
    }
