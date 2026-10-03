"""
Credit Cards API connected to PostgreSQL.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from decimal import Decimal
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from server.schemas.schemas import CreditCardCreate, CreditCardUpdate, CreditCardResponse, CardPaymentCreate
from server.models.models import CreditCard, CardPayment, Expense
from server.core.crypto import CryptoService
from server.api.deps import get_current_user_id, get_db

router = APIRouter(prefix="/cards", tags=["Credit Cards"])

@router.get("", response_model=List[CreditCardResponse])
async def list_cards(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(CreditCard).where(and_(CreditCard.user_id == user_id, CreditCard.is_deleted == False))
    )
    cards = result.scalars().all()

    # Fetch expenses charged to cards
    exp_res = await db.execute(select(Expense).where(and_(Expense.user_id == user_id, Expense.is_deleted == False, Expense.card_id.isnot(None))))
    expenses = exp_res.scalars().all()

    # Fetch card payments
    pay_res = await db.execute(select(CardPayment))
    payments = pay_res.scalars().all()

    responses = []
    for c in cards:
        limit = CryptoService.decrypt_decimal(c.credit_limit_encrypted, user_id, "credit_cards", "credit_limit")
        last4 = CryptoService.decrypt(c.last4_encrypted, user_id, "credit_cards", "last4") or "XXXX"

        charges = sum(
            CryptoService.decrypt_decimal(e.amount_encrypted, user_id, "expenses", "amount")
            for e in expenses if e.card_id == c.id
        )
        paids = sum(
            CryptoService.decrypt_decimal(p.amount_encrypted, user_id, "card_payments", "amount")
            for p in payments if p.card_id == c.id
        )
        outstanding = max(Decimal("0.00"), charges - paids)
        available = max(Decimal("0.00"), limit - outstanding)
        utilization = (outstanding / limit * 100) if limit > 0 else Decimal("0.00")

        ir = CryptoService.decrypt_decimal(c.interest_rate_encrypted, user_id, "credit_cards", "interest_rate") if c.interest_rate_encrypted else None

        responses.append(CreditCardResponse(
            id=c.id,
            nickname=c.nickname,
            issuer=c.issuer,
            last4=last4,
            credit_limit=limit,
            statement_day=c.statement_day,
            payment_due_day=c.payment_due_day,
            interest_rate=ir,
            color=c.color,
            is_closed=bool(getattr(c, "is_closed", False)),
            current_outstanding=outstanding,
            available_credit=available,
            utilization_percentage=round(utilization, 2)
        ))
    return responses

@router.post("", response_model=CreditCardResponse, status_code=status.HTTP_201_CREATED)
async def create_card(
    card: CreditCardCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    cid = f"card_{uuid.uuid4().hex[:12]}"
    last4_enc = CryptoService.encrypt(card.last4, user_id, "credit_cards", "last4")
    limit_enc = CryptoService.encrypt_decimal(card.credit_limit, user_id, "credit_cards", "credit_limit")
    interest_rate_enc = CryptoService.encrypt_decimal(card.interest_rate, user_id, "credit_cards", "interest_rate") if card.interest_rate is not None else None

    new_card = CreditCard(
        id=cid,
        user_id=user_id,
        nickname=card.nickname,
        issuer=card.issuer,
        last4_encrypted=last4_enc,
        credit_limit_encrypted=limit_enc,
        statement_day=card.statement_day,
        payment_due_day=card.payment_due_day,
        interest_rate_encrypted=interest_rate_enc,
        color=card.color or "#1E293B",
        is_closed=False,
        is_deleted=False
    )
    db.add(new_card)
    await db.commit()

    return CreditCardResponse(
        id=new_card.id,
        nickname=new_card.nickname,
        issuer=new_card.issuer,
        last4=card.last4,
        credit_limit=card.credit_limit,
        statement_day=new_card.statement_day,
        payment_due_day=new_card.payment_due_day,
        interest_rate=card.interest_rate,
        color=new_card.color,
        is_closed=False,
        current_outstanding=Decimal("0.00"),
        available_credit=card.credit_limit,
        utilization_percentage=Decimal("0.00")
    )

@router.put("/{card_id}", response_model=CreditCardResponse)
async def update_card(
    card_id: str,
    update_data: CreditCardUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CreditCard).where(and_(CreditCard.id == card_id, CreditCard.user_id == user_id, CreditCard.is_deleted == False)))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Card not found")

    if update_data.nickname is not None:
        c.nickname = update_data.nickname
    if update_data.issuer is not None:
        c.issuer = update_data.issuer
    if update_data.credit_limit is not None:
        c.credit_limit_encrypted = CryptoService.encrypt_decimal(update_data.credit_limit, user_id, "credit_cards", "credit_limit")
    if update_data.statement_day is not None:
        c.statement_day = update_data.statement_day
    if update_data.payment_due_day is not None:
        c.payment_due_day = update_data.payment_due_day
    if update_data.interest_rate is not None:
        c.interest_rate_encrypted = CryptoService.encrypt_decimal(update_data.interest_rate, user_id, "credit_cards", "interest_rate")
    if update_data.color is not None:
        c.color = update_data.color
    if update_data.is_closed is not None:
        c.is_closed = update_data.is_closed

    await db.commit()

    limit = CryptoService.decrypt_decimal(c.credit_limit_encrypted, user_id, "credit_cards", "credit_limit")
    last4 = CryptoService.decrypt(c.last4_encrypted, user_id, "credit_cards", "last4") or "XXXX"
    ir = CryptoService.decrypt_decimal(c.interest_rate_encrypted, user_id, "credit_cards", "interest_rate") if c.interest_rate_encrypted else None

    return CreditCardResponse(
        id=c.id,
        nickname=c.nickname,
        issuer=c.issuer,
        last4=last4,
        credit_limit=limit,
        statement_day=c.statement_day,
        payment_due_day=c.payment_due_day,
        interest_rate=ir,
        color=c.color,
        is_closed=bool(getattr(c, "is_closed", False)),
        current_outstanding=Decimal("0.00"),
        available_credit=limit,
        utilization_percentage=Decimal("0.00")
    )

@router.post("/{card_id}/payments")
async def record_card_payment(
    card_id: str,
    payment: CardPaymentCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    pid = f"cp_{uuid.uuid4().hex[:12]}"
    amt_enc = CryptoService.encrypt_decimal(payment.amount, user_id, "card_payments", "amount")
    note_enc = CryptoService.encrypt(payment.note or "", user_id, "card_payments", "note") if payment.note else None

    cp = CardPayment(
        id=pid,
        user_id=user_id,
        card_id=card_id,
        amount_encrypted=amt_enc,
        payment_date=payment.payment_date,
        payment_source=payment.payment_source or "Bank Account",
        note_encrypted=note_enc
    )
    db.add(cp)
    await db.commit()

    return {"message": "Card payment recorded successfully.", "id": pid, "amount": payment.amount}

@router.delete("/{card_id}")
async def delete_card(
    card_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CreditCard).where(and_(CreditCard.id == card_id, CreditCard.user_id == user_id)))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Card not found")
    c.is_deleted = True
    await db.commit()
    return {"message": "Card deleted successfully", "id": card_id}
