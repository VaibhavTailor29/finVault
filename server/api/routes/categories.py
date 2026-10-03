"""
Categories & Budgets API connected to PostgreSQL.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from decimal import Decimal
import uuid
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from server.models.models import Category, Budget
from server.core.crypto import CryptoService
from server.api.deps import get_current_user_id, get_db

router = APIRouter(prefix="/categories", tags=["Categories & Budgets"])

class CategoryItemResponse(BaseModel):
    id: str
    name: str
    icon: str
    color: str
    monthly_budget: Decimal

class SetCategoryBudgetRequest(BaseModel):
    monthly_budget: Decimal

class OverallBudgetRequest(BaseModel):
    month: int
    year: int
    overall_amount: Decimal

class OverallBudgetResponse(BaseModel):
    id: str
    month: int
    year: int
    overall_amount: Decimal

@router.get("", response_model=List[CategoryItemResponse])
async def list_categories(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(Category).where(and_(Category.user_id == user_id, Category.is_deleted == False)))
    cats = res.scalars().all()
    results = []
    for c in cats:
        b_amt = CryptoService.decrypt_decimal(c.budget_amount_encrypted or "0", user_id, "categories", "budget_amount")
        results.append(CategoryItemResponse(
            id=c.id,
            name=c.name,
            icon=c.icon,
            color=c.color,
            monthly_budget=b_amt
        ))
    return results

@router.put("/{category_id}/budget")
async def update_category_budget(
    category_id: str,
    req: SetCategoryBudgetRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(Category).where(and_(Category.id == category_id, Category.user_id == user_id)))
    cat = res.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    
    enc = CryptoService.encrypt_decimal(req.monthly_budget, user_id, "categories", "budget_amount")
    cat.budget_amount_encrypted = enc
    await db.commit()
    return {"message": "Category budget updated", "id": category_id, "monthly_budget": req.monthly_budget}

budget_router = APIRouter(prefix="/budgets", tags=["Budgets"])

@budget_router.get("", response_model=List[OverallBudgetResponse])
async def list_budgets(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(Budget).where(Budget.user_id == user_id))
    budgets = res.scalars().all()
    results = []
    for b in budgets:
        amt = CryptoService.decrypt_decimal(b.overall_amount_encrypted, user_id, "budgets", "overall_amount")
        results.append(OverallBudgetResponse(
            id=b.id,
            month=b.month,
            year=b.year,
            overall_amount=amt
        ))
    return results

@budget_router.post("", response_model=OverallBudgetResponse)
async def set_overall_budget(
    req: OverallBudgetRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(Budget).where(and_(Budget.user_id == user_id, Budget.month == req.month, Budget.year == req.year))
    )
    b = res.scalar_one_or_none()
    amt_enc = CryptoService.encrypt_decimal(req.overall_amount, user_id, "budgets", "overall_amount")

    if b:
        b.overall_amount_encrypted = amt_enc
    else:
        bid = f"b_{req.month}_{req.year}"
        b = Budget(
            id=bid,
            user_id=user_id,
            month=req.month,
            year=req.year,
            overall_amount_encrypted=amt_enc
        )
        db.add(b)
    await db.commit()
    await db.refresh(b)

    return OverallBudgetResponse(
        id=b.id,
        month=b.month,
        year=b.year,
        overall_amount=req.overall_amount
    )
