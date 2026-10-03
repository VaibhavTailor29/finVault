"""
Bank Accounts & Wallets API connected to PostgreSQL.
"""
from typing import List, Optional
from datetime import date, datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from server.schemas.schemas import (
    AccountCreate, AccountResponse, TransferCreate, TransferResponse, ReconcileRequest
)
from server.models.models import Account, Transfer, Expense, Income
from server.core.crypto import CryptoService
from server.api.deps import get_current_user_id, get_db

router = APIRouter(prefix="/accounts", tags=["Bank Accounts & Wallets"])

@router.get("", response_model=List[AccountResponse])
async def list_accounts(
    include_archived: bool = False,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    query = select(Account).where(
        and_(Account.user_id == user_id, Account.is_deleted == False)
    )
    if not include_archived:
        query = query.where(Account.is_archived == False)
        
    result = await db.execute(query)
    accounts = result.scalars().all()
    
    # Fetch expenses and incomes to calculate dynamic balances
    exp_res = await db.execute(select(Expense).where(and_(Expense.user_id == user_id, Expense.is_deleted == False)))
    expenses = exp_res.scalars().all()
    
    inc_res = await db.execute(select(Income).where(and_(Income.user_id == user_id, Income.is_deleted == False)))
    incomes = inc_res.scalars().all()
    
    tr_res = await db.execute(select(Transfer).where(and_(Transfer.user_id == user_id, Transfer.is_deleted == False)))
    transfers = tr_res.scalars().all()
    
    responses = []
    for acc in accounts:
        opening = CryptoService.decrypt_decimal(acc.opening_balance_encrypted, user_id, "accounts", "opening_balance")
        
        # Calculate dynamic balance
        total_in = sum(
            CryptoService.decrypt_decimal(i.amount_encrypted, user_id, "incomes", "amount")
            for i in incomes if i.account_id == acc.id
        )
        total_out = sum(
            CryptoService.decrypt_decimal(e.amount_encrypted, user_id, "expenses", "amount")
            for e in expenses if e.account_id == acc.id
        )
        tr_in = sum(
            CryptoService.decrypt_decimal(t.amount_encrypted, user_id, "transfers", "amount")
            for t in transfers if t.to_account_id == acc.id
        )
        tr_out = sum(
            CryptoService.decrypt_decimal(t.amount_encrypted, user_id, "transfers", "amount")
            for t in transfers if t.from_account_id == acc.id
        )
        
        current = opening + total_in + tr_in - total_out - tr_out
        
        responses.append(AccountResponse(
            id=acc.id,
            name=acc.name,
            type=acc.type,
            opening_balance=opening,
            current_balance=current,
            currency=acc.currency,
            color=acc.color,
            is_archived=acc.is_archived,
            reconciliation_date=acc.last_reconciled_at.date() if acc.last_reconciled_at else None,
            last_reconciled_balance=current if acc.last_reconciled_at else None
        ))
    return responses

@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_in: AccountCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    import uuid
    acc_id = f"acc_{uuid.uuid4().hex[:12]}"
    enc_bal = CryptoService.encrypt_decimal(account_in.opening_balance, user_id, "accounts", "opening_balance")
    
    account = Account(
        id=acc_id,
        user_id=user_id,
        name=account_in.name,
        type=account_in.type,
        opening_balance_encrypted=enc_bal,
        currency=account_in.currency or "INR",
        color=account_in.color or "#4F46E5",
        is_archived=False,
        last_reconciled_at=datetime.combine(account_in.reconciliation_date, datetime.min.time(), tzinfo=timezone.utc) if account_in.reconciliation_date else None
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    
    return AccountResponse(
        id=account.id,
        name=account.name,
        type=account.type,
        opening_balance=account_in.opening_balance,
        current_balance=account_in.opening_balance,
        currency=account.currency,
        color=account.color,
        is_archived=account.is_archived,
        reconciliation_date=account_in.reconciliation_date
    )

@router.delete("/{account_id}")
async def delete_account(
    account_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Account).where(and_(Account.id == account_id, Account.user_id == user_id))
    )
    acc = result.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    acc.is_deleted = True
    acc.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Account deleted successfully", "id": account_id}

@router.get("/transfers", response_model=List[TransferResponse])
async def list_transfers(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Transfer).where(and_(Transfer.user_id == user_id, Transfer.is_deleted == False))
    )
    transfers = result.scalars().all()
    
    acc_res = await db.execute(select(Account).where(Account.user_id == user_id))
    acc_map = {a.id: a.name for a in acc_res.scalars().all()}
    
    responses = []
    for t in transfers:
        amt = CryptoService.decrypt_decimal(t.amount_encrypted, user_id, "transfers", "amount")
        note = CryptoService.decrypt(t.note_encrypted, user_id, "transfers", "note") if t.note_encrypted else None
        responses.append(TransferResponse(
            id=t.id,
            from_account_id=t.from_account_id,
            to_account_id=t.to_account_id,
            from_account_name=acc_map.get(t.from_account_id, "Source Account"),
            to_account_name=acc_map.get(t.to_account_id, "Destination Account"),
            amount=amt,
            fee=Decimal("0.00"),
            date=t.date,
            note=note
        ))
    return responses

@router.post("/transfers", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
async def create_transfer(
    transfer_in: TransferCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    if transfer_in.from_account_id == transfer_in.to_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination accounts must be different."
        )
    import uuid
    tr_id = f"tr_{uuid.uuid4().hex[:12]}"
    amt_enc = CryptoService.encrypt_decimal(transfer_in.amount, user_id, "transfers", "amount")
    note_enc = CryptoService.encrypt(transfer_in.note or "", user_id, "transfers", "note") if transfer_in.note else None

    transfer = Transfer(
        id=tr_id,
        user_id=user_id,
        from_account_id=transfer_in.from_account_id,
        to_account_id=transfer_in.to_account_id,
        amount_encrypted=amt_enc,
        date=transfer_in.date,
        note_encrypted=note_enc
    )
    db.add(transfer)
    await db.commit()

    return TransferResponse(
        id=tr_id,
        from_account_id=transfer_in.from_account_id,
        to_account_id=transfer_in.to_account_id,
        amount=transfer_in.amount,
        fee=transfer_in.fee,
        date=transfer_in.date,
        note=transfer_in.note
    )

@router.post("/{account_id}/reconcile", response_model=AccountResponse)
async def reconcile_account(
    account_id: str,
    reconcile_in: ReconcileRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Account).where(and_(Account.id == account_id, Account.user_id == user_id))
    )
    acc = result.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    reconciled_date = reconcile_in.reconciled_date or date.today()
    acc.last_reconciled_at = datetime.combine(reconciled_date, datetime.min.time(), tzinfo=timezone.utc)
    await db.commit()

    opening = CryptoService.decrypt_decimal(acc.opening_balance_encrypted, user_id, "accounts", "opening_balance")
    return AccountResponse(
        id=acc.id,
        name=acc.name,
        type=acc.type,
        opening_balance=opening,
        current_balance=reconcile_in.statement_balance,
        currency=acc.currency,
        color=acc.color,
        is_archived=acc.is_archived,
        reconciliation_date=reconciled_date,
        last_reconciled_balance=reconcile_in.statement_balance
    )
