"""
Transactions API: Expenses & Incomes connected directly to PostgreSQL.
"""
from typing import List, Optional
from datetime import date, datetime, timezone
from decimal import Decimal
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc

from server.schemas.schemas import (
    ExpenseCreate, ExpenseResponse, IncomeCreate, IncomeResponse
)
from server.models.models import Expense, Income, Category
from server.core.crypto import CryptoService
from server.api.deps import get_current_user_id, get_db

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.get("/expenses", response_model=List[ExpenseResponse])
async def list_expenses(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Expense).where(and_(Expense.user_id == user_id, Expense.is_deleted == False)).order_by(desc(Expense.date))
    )
    expenses = result.scalars().all()
    
    cat_res = await db.execute(select(Category).where(Category.user_id == user_id))
    cat_map = {c.id: c for c in cat_res.scalars().all()}
    
    responses = []
    for exp in expenses:
        amt = CryptoService.decrypt_decimal(exp.amount_encrypted, user_id, "expenses", "amount")
        note = CryptoService.decrypt(exp.note_encrypted, user_id, "expenses", "note") if exp.note_encrypted else None
        cat = cat_map.get(exp.category_id)
        
        responses.append(ExpenseResponse(
            id=exp.id,
            amount=amt,
            category_id=exp.category_id,
            category_name=cat.name if cat else "General",
            category_icon=cat.icon if cat else "tag",
            category_color=cat.color if cat else "#6366F1",
            date=exp.date,
            payment_method=exp.payment_method,
            note=note,
            tags=[],
            card_id=exp.card_id,
            person_id=exp.person_id,
            is_recurring=exp.is_recurring,
            recurring_frequency=exp.recurring_frequency,
            created_at=exp.created_at
        ))
    return responses

@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    expense: ExpenseCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    exp_id = f"exp_{uuid.uuid4().hex[:12]}"
    amount_enc = CryptoService.encrypt_decimal(expense.amount, user_id, "expenses", "amount")
    note_enc = CryptoService.encrypt(expense.note or "", user_id, "expenses", "note") if expense.note else None
    
    cat_res = await db.execute(select(Category).where(Category.id == expense.category_id))
    cat = cat_res.scalar_one_or_none()

    new_exp = Expense(
        id=exp_id,
        user_id=user_id,
        account_id=expense.card_id if not expense.card_id else None,  # or linked account
        amount_encrypted=amount_enc,
        category_id=expense.category_id,
        date=expense.date,
        payment_method=expense.payment_method,
        note_encrypted=note_enc,
        card_id=expense.card_id,
        person_id=expense.person_id,
        is_recurring=expense.is_recurring,
        recurring_frequency=expense.recurring_frequency,
        is_deleted=False
    )
    db.add(new_exp)
    await db.commit()
    await db.refresh(new_exp)

    return ExpenseResponse(
        id=new_exp.id,
        amount=expense.amount,
        category_id=expense.category_id,
        category_name=cat.name if cat else "General",
        category_icon=cat.icon if cat else "tag",
        category_color=cat.color if cat else "#6366F1",
        date=expense.date,
        payment_method=expense.payment_method,
        note=expense.note,
        tags=expense.tags,
        card_id=expense.card_id,
        person_id=expense.person_id,
        is_recurring=expense.is_recurring,
        recurring_frequency=expense.recurring_frequency,
        created_at=new_exp.created_at
    )

@router.delete("/expenses/{id}")
async def soft_delete_expense(
    id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Expense).where(and_(Expense.id == id, Expense.user_id == user_id)))
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    exp.is_deleted = True
    exp.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Expense deleted successfully", "id": id}

@router.post("/expenses/{id}/restore")
async def restore_expense(
    id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Expense).where(and_(Expense.id == id, Expense.user_id == user_id)))
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    exp.is_deleted = False
    exp.deleted_at = None
    await db.commit()
    return {"message": "Expense restored successfully.", "id": id}

@router.get("/incomes", response_model=List[IncomeResponse])
async def list_incomes(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Income).where(and_(Income.user_id == user_id, Income.is_deleted == False)).order_by(desc(Income.date))
    )
    incomes = result.scalars().all()
    
    responses = []
    for inc in incomes:
        amt = CryptoService.decrypt_decimal(inc.amount_encrypted, user_id, "incomes", "amount")
        note = CryptoService.decrypt(inc.note_encrypted, user_id, "incomes", "note") if inc.note_encrypted else None
        responses.append(IncomeResponse(
            id=inc.id,
            amount=amt,
            source=inc.source,
            date=inc.date,
            note=note,
            tags=[],
            is_recurring=inc.is_recurring,
            recurring_frequency=inc.recurring_frequency,
            created_at=inc.created_at
        ))
    return responses

@router.post("/incomes", response_model=IncomeResponse, status_code=status.HTTP_201_CREATED)
async def create_income(
    income: IncomeCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    inc_id = f"inc_{uuid.uuid4().hex[:12]}"
    amount_enc = CryptoService.encrypt_decimal(income.amount, user_id, "incomes", "amount")
    note_enc = CryptoService.encrypt(income.note or "", user_id, "incomes", "note") if income.note else None

    new_inc = Income(
        id=inc_id,
        user_id=user_id,
        amount_encrypted=amount_enc,
        source=income.source,
        date=income.date,
        note_encrypted=note_enc,
        is_recurring=income.is_recurring,
        recurring_frequency=income.recurring_frequency,
        is_deleted=False
    )
    db.add(new_inc)
    await db.commit()
    await db.refresh(new_inc)

    return IncomeResponse(
        id=new_inc.id,
        amount=income.amount,
        source=income.source,
        date=income.date,
        note=income.note,
        tags=income.tags,
        is_recurring=income.is_recurring,
        recurring_frequency=income.recurring_frequency,
        created_at=new_inc.created_at
    )

@router.delete("/incomes/{id}")
async def delete_income(
    id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Income).where(and_(Income.id == id, Income.user_id == user_id)))
    inc = result.scalar_one_or_none()
    if not inc:
        raise HTTPException(status_code=404, detail="Income not found")
    inc.is_deleted = True
    inc.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Income deleted successfully", "id": id}
