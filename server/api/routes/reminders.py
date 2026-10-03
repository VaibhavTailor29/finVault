"""
Reminders and Email Notifications API Routes:
Allows sending debt reminders to contacts, payment alerts, and test notifications.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from server.api.deps import get_current_user_id, get_db
from server.core.config import settings
from server.core.crypto import CryptoService
from server.models.models import User
from server.services.email_service import EmailService

router = APIRouter(prefix="/reminders", tags=["Reminders & Notifications"])

class SendEmailReminderRequest(BaseModel):
    recipient_email: str
    subject: str
    body: str
    html_body: Optional[str] = None
    reminder_type: Optional[str] = "debt_reminder"

class DebtReminderRequest(BaseModel):
    person_id: Optional[str] = None
    person_name: str
    recipient_email: str
    net_balance: float
    currency: Optional[str] = "INR"
    entries: Optional[List[Dict[str, Any]]] = []

class TestReminderRequest(BaseModel):
    email: str
    currency: Optional[str] = "INR"
    sample_dues: Optional[List[Dict[str, Any]]] = []

@router.get("/status")
async def get_reminder_status(
    user_id: str = Depends(get_current_user_id)
):
    """Returns email service delivery status."""
    is_configured = bool(settings.SMTP_USER and settings.SMTP_PASSWORD)
    from_address = settings.SMTP_FROM or settings.SMTP_USER or ""
    return {
        "status": "ready",
        "service": "Email Service",
        "smtp_configured": is_configured,
        "mode": "smtp",
        "sender_address": from_address,
        "smtp_host": settings.SMTP_HOST or "",
        "smtp_port": settings.SMTP_PORT or 587,
        "smtp_user": settings.SMTP_USER,
        "info": "Emails are dispatched live using the configured email service."
    }

@router.post("/send-email")
async def send_custom_reminder(
    req: SendEmailReminderRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Dispatches a custom formatted email reminder."""
    res = await EmailService.send_email(
        to_email=req.recipient_email,
        subject=req.subject,
        text_body=req.body,
        html_body=req.html_body,
        category=req.reminder_type or "general"
    )
    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=res.get("error", "Failed to dispatch email.")
        )
    return res

@router.post("/send-debt-reminder")
async def send_debt_reminder(
    req: DebtReminderRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Builds a structured ledger statement and dispatches an email reminder
    to a contact who owes money.
    """
    sender_name = "Your Contact"
    try:
        res = await db.execute(select(User).where(User.id == user_id))
        db_user = res.scalar_one_or_none()
        if db_user and db_user.name_encrypted:
            sender_name = CryptoService.decrypt(db_user.name_encrypted, user_id, "users", "name")
    except Exception:
        pass

    reminder_content = EmailService.generate_debt_reminder(
        person_name=req.person_name,
        sender_name=sender_name,
        net_balance=req.net_balance,
        currency=req.currency or "INR",
        entries=req.entries or []
    )

    res = await EmailService.send_email(
        to_email=req.recipient_email,
        subject=reminder_content["subject"],
        text_body=reminder_content["text_body"],
        html_body=reminder_content["html_body"],
        category="debt_reminder"
    )
    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=res.get("error", "Failed to dispatch reminder.")
        )
    return res

@router.post("/send-test")
async def send_test_reminder(
    req: TestReminderRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Dispatches a test reminder email."""
    user_name = "there"
    try:
        res = await db.execute(select(User).where(User.id == user_id))
        db_user = res.scalar_one_or_none()
        if db_user and db_user.name_encrypted:
            fetched_name = CryptoService.decrypt(db_user.name_encrypted, user_id, "users", "name")
            user_name = fetched_name.split()[0] if fetched_name else "there"
    except Exception:
        pass

    sample_dues = req.sample_dues or [
        {"title": "Upcoming Bill", "due_in": "Due soon", "amount": 0.0},
    ]

    reminder_content = EmailService.generate_due_alert(
        user_name=user_name,
        due_items=sample_dues,
        currency=req.currency or "INR"
    )

    res = await EmailService.send_email(
        to_email=req.email,
        subject=f"[Test] {reminder_content['subject']}",
        text_body=reminder_content["text_body"],
        html_body=reminder_content["html_body"],
        category="test_reminder"
    )
    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=res.get("error", "Failed to send test email.")
        )
    return res
