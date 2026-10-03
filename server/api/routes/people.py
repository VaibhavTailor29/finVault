"""
People Ledger API connected to PostgreSQL.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from decimal import Decimal
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from server.schemas.schemas import PersonCreate, PersonResponse, LedgerEntryCreate
from server.models.models import Person, LedgerEntry
from server.core.crypto import CryptoService
from server.api.deps import get_current_user_id, get_db

router = APIRouter(prefix="/people", tags=["People Ledger"])

@router.get("", response_model=List[PersonResponse])
async def list_people(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    p_res = await db.execute(
        select(Person).where(and_(Person.user_id == user_id, Person.is_deleted == False))
    )
    people = p_res.scalars().all()

    l_res = await db.execute(
        select(LedgerEntry).where(and_(LedgerEntry.user_id == user_id, LedgerEntry.is_deleted == False))
    )
    entries = l_res.scalars().all()

    responses = []
    for p in people:
        name = CryptoService.decrypt(p.name_encrypted, user_id, "people", "name") or "Contact"
        phone = CryptoService.decrypt(p.phone_encrypted, user_id, "people", "phone") if p.phone_encrypted else None
        notes = CryptoService.decrypt(p.notes_encrypted, user_id, "people", "notes") if p.notes_encrypted else None
        email = CryptoService.decrypt(p.email_encrypted, user_id, "people", "email") if p.email_encrypted else None

        net_balance = Decimal("0.00")
        p_entries = [e for e in entries if e.person_id == p.id and not e.is_settled]
        for e in p_entries:
            amt = CryptoService.decrypt_decimal(e.amount_encrypted, user_id, "ledger_entries", "amount")
            if e.type == "lent":
                net_balance += amt
            elif e.type == "borrowed":
                net_balance -= amt

        responses.append(PersonResponse(
            id=p.id,
            name=name,
            phone=phone,
            email=email,
            notes=notes,
            avatar_color=p.avatar_color,
            net_balance=net_balance,
            is_settled=(net_balance == 0)
        ))
    return responses

@router.post("", response_model=PersonResponse, status_code=status.HTTP_201_CREATED)
async def create_person(
    person: PersonCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    pid = f"p_{uuid.uuid4().hex[:12]}"
    name_enc = CryptoService.encrypt(person.name, user_id, "people", "name")
    phone_enc = CryptoService.encrypt(person.phone or "", user_id, "people", "phone") if person.phone else None
    email_enc = CryptoService.encrypt(str(person.email), user_id, "people", "email") if person.email else None
    notes_enc = CryptoService.encrypt(person.notes or "", user_id, "people", "notes") if person.notes else None

    new_p = Person(
        id=pid,
        user_id=user_id,
        name_encrypted=name_enc,
        phone_encrypted=phone_enc,
        email_encrypted=email_enc,
        notes_encrypted=notes_enc,
        avatar_color=person.avatar_color or "#10B981",
        is_deleted=False
    )
    db.add(new_p)
    await db.commit()

    return PersonResponse(
        id=pid,
        name=person.name,
        phone=person.phone,
        email=person.email,
        notes=person.notes,
        avatar_color=new_p.avatar_color,
        net_balance=Decimal("0.00"),
        is_settled=True
    )

@router.get("/ledger")
async def list_ledger(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(LedgerEntry).where(and_(LedgerEntry.user_id == user_id, LedgerEntry.is_deleted == False))
    )
    entries = res.scalars().all()
    results = []
    for e in entries:
        amt = CryptoService.decrypt_decimal(e.amount_encrypted, user_id, "ledger_entries", "amount")
        note = CryptoService.decrypt(e.note_encrypted, user_id, "ledger_entries", "note") if e.note_encrypted else None
        results.append({
            "id": e.id,
            "personId": e.person_id,
            "type": e.type,
            "amount": float(amt),
            "date": str(e.date),
            "note": note,
            "isSettled": e.is_settled,
            "dueDate": str(e.due_date) if e.due_date else None,
            "createdAt": e.created_at.isoformat() if e.created_at else None
        })
    return results

@router.post("/{person_id}/ledger", status_code=status.HTTP_201_CREATED)
async def add_ledger_entry(
    person_id: str,
    entry: LedgerEntryCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    lid = f"led_{uuid.uuid4().hex[:12]}"
    amt_enc = CryptoService.encrypt_decimal(entry.amount, user_id, "ledger_entries", "amount")
    note_enc = CryptoService.encrypt(entry.note or "", user_id, "ledger_entries", "note") if entry.note else None

    new_e = LedgerEntry(
        id=lid,
        user_id=user_id,
        person_id=person_id,
        type=entry.type,
        amount_encrypted=amt_enc,
        date=entry.date,
        note_encrypted=note_enc,
        due_date=entry.due_date,
        is_settled=False
    )
    db.add(new_e)
    await db.commit()

    return {"message": "Ledger entry recorded.", "id": lid, "amount": float(entry.amount)}

@router.post("/{person_id}/settle")
async def settle_debt(
    person_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(LedgerEntry).where(and_(LedgerEntry.user_id == user_id, LedgerEntry.person_id == person_id, LedgerEntry.is_settled == False))
    )
    entries = res.scalars().all()
    now_utc = datetime.now(timezone.utc)
    for e in entries:
        e.is_settled = True
        e.settled_at = now_utc
    await db.commit()
    return {"message": f"Settled {len(entries)} ledger entries for person.", "count": len(entries)}

@router.delete("/ledger/{entry_id}", status_code=status.HTTP_200_OK)
async def delete_ledger_entry(
    entry_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Deletes an individual ledger entry."""
    res = await db.execute(
        select(LedgerEntry).where(and_(LedgerEntry.id == entry_id, LedgerEntry.user_id == user_id))
    )
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found.")
    
    entry.is_deleted = True
    entry.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Ledger entry deleted successfully."}

@router.delete("/{person_id}", status_code=status.HTTP_200_OK)
async def delete_person(
    person_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Deletes a person contact and all associated ledger entries."""
    res = await db.execute(
        select(Person).where(and_(Person.id == person_id, Person.user_id == user_id))
    )
    person = res.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")
    
    now_utc = datetime.now(timezone.utc)
    person.is_deleted = True
    person.deleted_at = now_utc

    # Soft delete all associated ledger entries
    l_res = await db.execute(
        select(LedgerEntry).where(and_(LedgerEntry.person_id == person_id, LedgerEntry.user_id == user_id))
    )
    for entry in l_res.scalars().all():
        entry.is_deleted = True
        entry.deleted_at = now_utc

    await db.commit()
    return {"message": "Person ledger and associated entries deleted successfully."}
