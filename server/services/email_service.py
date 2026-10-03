"""
Email Service for FinVault:
Supports sending transactional notifications and reminders via SMTP (fastapi_mail)
with graceful fallback/simulation when SMTP is not configured.
"""
import logging
from typing import Optional, List, Dict, Any
from server.core.config import settings

logger = logging.getLogger("finvault.email")

class EmailService:
    @staticmethod
    async def send_email(
        to_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str] = None,
        category: str = "general"
    ) -> Dict[str, Any]:
        """
        Sends an email using FastAPI-Mail if SMTP_HOST is configured,
        otherwise logs and simulates delivery successfully.
        """
        # Validate recipient
        clean_email = to_email.strip()
        if not clean_email or "@" not in clean_email:
            return {"success": False, "error": "A valid recipient email address is required."}

        # Check SMTP credentials
        smtp_user = (settings.SMTP_USER or "").strip()
        raw_pwd = (settings.SMTP_PASSWORD or "").strip()
        smtp_password = raw_pwd.replace(" ", "")

        if not smtp_user or not smtp_password:
            error_msg = "Email service is not configured. Please set SMTP credentials in .env."
            logger.error(f"[EmailService] {error_msg}")
            return {"success": False, "error": error_msg}

        from_email = (settings.SMTP_FROM or smtp_user).strip()
        from_name = (settings.SMTP_FROM_NAME or "FinVault").strip()

        try:
            from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

            mail_server = (settings.SMTP_HOST or "smtp.gmail.com").strip()
            mail_port = settings.SMTP_PORT or 587
            is_ssl = bool(settings.SMTP_SSL or mail_port == 465)
            is_starttls = bool(settings.SMTP_TLS) if not is_ssl else False

            conf = ConnectionConfig(
                MAIL_USERNAME=smtp_user,
                MAIL_PASSWORD=smtp_password,
                MAIL_FROM=from_email,
                MAIL_FROM_NAME=from_name,
                MAIL_PORT=mail_port,
                MAIL_SERVER=mail_server,
                MAIL_STARTTLS=is_starttls,
                MAIL_SSL_TLS=is_ssl,
                USE_CREDENTIALS=True,
                VALIDATE_CERTS=True,
            )

            message = MessageSchema(
                subject=subject,
                recipients=[clean_email],
                body=html_body or text_body,
                subtype=MessageType.html if html_body else MessageType.plain
            )

            fm = FastMail(conf)
            await fm.send_message(message)
            logger.info(f"[EmailService] Email successfully delivered to {clean_email}: '{subject}'")
            return {
                "success": True,
                "dispatched": True,
                "mode": "smtp",
                "recipient": clean_email,
                "subject": subject,
                "message": f"Email successfully dispatched to {clean_email}."
            }
        except Exception as e:
            error_msg = f"Failed to send email: {str(e)}"
            logger.error(f"[EmailService] {error_msg}")
            return {
                "success": False,
                "dispatched": False,
                "error": error_msg
            }

    @staticmethod
    def generate_password_reset_email(
        user_name: str,
        reset_url: str
    ) -> Dict[str, str]:
        """Generates secure password reset email with direct link."""
        subject = "Reset Your FinVault Password"
        text_body = f"""Hi {user_name},

We received a request to reset your password for your FinVault account.

Click the link below or copy and paste it into your browser to reset your password:
{reset_url}

This password reset link is valid for 30 minutes. If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
FinVault Security Team
(Sent via FinVault Personal Finance Tracker)
"""
        html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }}
    .card {{ max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .logo {{ display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: #4f46e5; border-radius: 12px; color: #ffffff; font-weight: 800; font-size: 18px; margin-bottom: 20px; }}
    .title {{ font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; }}
    .btn {{ display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px; margin: 24px 0; }}
    .btn:hover {{ background-color: #4338ca; }}
    .note {{ font-size: 12px; color: #64748b; line-height: 1.5; }}
    .link-box {{ background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 11px; word-break: break-all; color: #334155; margin-top: 16px; }}
    .footer {{ margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">FV</div>
    <h2 class="title">Password Reset Request</h2>
    <p style="font-size: 14px; line-height: 1.5; color: #334155;">Hi <strong>{user_name}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.5; color: #334155;">We received a request to reset the password for your FinVault account. Click the button below to choose a new password:</p>
    
    <div style="text-align: center;">
      <a href="{reset_url}" target="_blank" class="btn">Reset Password</a>
    </div>

    <p class="note">This link will expire in <strong>30 minutes</strong> for your security. If you did not make this request, you can safely ignore this email.</p>
    
    <div class="link-box">
      If the button above doesn't work, copy and paste this URL into your browser:<br>
      <a href="{reset_url}" style="color: #4f46e5;">{reset_url}</a>
    </div>

    <div class="footer">
      FinVault &middot; Personal Finance &amp; Expense Tracker &middot; End-to-End Encrypted Records
    </div>
  </div>
</body>
</html>"""
        return {"subject": subject, "text_body": text_body, "html_body": html_body}

    @staticmethod
    def generate_debt_reminder(
        person_name: str,
        sender_name: str,
        net_balance: float,
        currency: str,
        entries: List[Dict[str, Any]]
    ) -> Dict[str, str]:
        """Generates friendly email reminder for unsettled debt."""
        formatted_balance = f"{currency} {abs(net_balance):,.2f}"
        subject = f"Friendly Reminder: Pending balance of {formatted_balance} with {sender_name}"

        unsettled_lines = []
        for e in entries:
            note = e.get("note") or ("Lent" if e.get("type") == "lent" else "Borrowed")
            date_str = str(e.get("date", ""))[:10]
            amt = f"{currency} {float(e.get('amount', 0)):,.2f}"
            unsettled_lines.append(f"• [{date_str}] {note}: {amt}")

        entries_text = "\n".join(unsettled_lines) if unsettled_lines else "• Consolidated pending balance"

        text_body = f"""Hi {person_name},

This is a friendly reminder regarding our shared balance on FinVault.

Summary of pending balance:
- Total Balance Due: {formatted_balance}
- Sender: {sender_name}

Unsettled Entries:
{entries_text}

Whenever you have a moment, please check and settle at your convenience. Thank you!

Best regards,
{sender_name}
(Sent via FinVault Personal Finance Tracker)
"""

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }}
    .card {{ max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .header {{ border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px; }}
    .title {{ font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }}
    .amount-box {{ background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }}
    .amount-label {{ font-size: 12px; text-transform: uppercase; color: #166534; font-weight: 600; letter-spacing: 0.05em; }}
    .amount-value {{ font-size: 28px; font-weight: 800; color: #15803d; font-family: monospace; margin-top: 4px; }}
    .entries {{ background: #f8fafc; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; }}
    .footer {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #64748b; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 class="title">Payment Reminder Statement</h2>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">From {sender_name}</p>
    </div>
    <p>Hi <strong>{person_name}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.5;">This is a friendly statement reminder regarding our shared balance recorded on FinVault.</p>
    
    <div class="amount-box">
      <div class="amount-label">Outstanding Balance</div>
      <div class="amount-value">{formatted_balance}</div>
    </div>

    <div class="entries">
      <div style="font-weight: 600; margin-bottom: 8px;">Breakdown of Unsettled Items:</div>
      <pre style="margin: 0; font-family: inherit; font-size: 12px; line-height: 1.6; white-space: pre-wrap;">{entries_text}</pre>
    </div>

    <p style="font-size: 13px; color: #475569;">Please review and settle whenever convenient. Thank you!</p>

    <div class="footer">
      Sent with FinVault Personal Finance &amp; Expense Tracker · Secure Financial Records
    </div>
  </div>
</body>
</html>
"""
        return {"subject": subject, "text_body": text_body, "html_body": html_body}

    @staticmethod
    def generate_due_alert(
        user_name: str,
        due_items: List[Dict[str, Any]],
        currency: str
    ) -> Dict[str, str]:
        """Generates due date reminders for credit cards, loans, and recurring subscriptions."""
        count = len(due_items)
        subject = f"FinVault Alert: {count} Payment Due{'s' if count != 1 else ''} Approaching"

        lines = []
        for item in due_items:
            title = item.get("title", "Payment")
            due_in = item.get("due_in", "Soon")
            amount = f"{currency} {float(item.get('amount', 0)):,.2f}"
            lines.append(f"• {title} — Due: {due_in} ({amount})")

        items_text = "\n".join(lines)

        text_body = f"""Hello {user_name},

This is an automated due date reminder from FinVault for your upcoming payment commitments:

{items_text}

Please ensure sufficient balance in your linked settlement accounts to avoid late fees or interest charges.

Best regards,
FinVault Automated Reminders
"""

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }}
    .card {{ max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .title {{ font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; }}
    .item {{ border-left: 3px solid #6366f1; background: #f8fafc; padding: 12px 16px; margin: 10px 0; border-radius: 4px; }}
    .footer {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #64748b; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <h2 class="title">Upcoming Payment Reminders</h2>
    <p>Hi <strong>{user_name}</strong>,</p>
    <p style="font-size: 14px;">The following payment commitments are approaching their due date:</p>
    <div>
      {''.join(f'<div class="item"><strong>{item.get("title")}</strong><br><span style="font-size:12px;color:#64748b;">Due: {item.get("due_in")} &middot; Amount: {currency} {float(item.get("amount",0)):,.2f}</span></div>' for item in due_items)}
    </div>
    <p style="font-size: 13px; color: #475569; margin-top: 16px;">Ensure adequate balance in your bank account prior to auto-debit dates.</p>
    <div class="footer">FinVault Personal Finance &amp; Expense Tracker</div>
  </div>
</body>
</html>
"""
        return {"subject": subject, "text_body": text_body, "html_body": html_body}
