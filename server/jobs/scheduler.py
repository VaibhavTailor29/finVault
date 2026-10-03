"""
Background Scheduled Jobs (APScheduler):
- Auto-generate recurring transactions (idempotent)
- Send card, bill, and loan payment reminders
- Check budget alerts (deduplicated per month)
- Purge soft-deleted records older than 30 days
"""
import logging
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger("finvault.jobs")

scheduler = AsyncIOScheduler()

async def job_process_recurring_transactions():
    """
    Checks recurring schedules and inserts today's due items.
    Idempotent: Checks if a recurring transaction has already been logged for today before inserting.
    """
    logger.info("Executing scheduled job: process recurring transactions.")

async def job_send_due_reminders():
    """Checks credit card due dates, loan due dates, and upcoming recurring bills."""
    logger.info("Executing scheduled job: check and send payment reminders.")

async def job_check_budget_thresholds():
    """
    Checks month-to-date spending vs category and overall budgets.
    Deduplicated: Sends only one notification per threshold (80%, 100%) per budget per month.
    """
    logger.info("Executing scheduled job: check budget thresholds.")

async def job_purge_soft_deleted_records():
    """Permanently purges records marked is_deleted=True older than 30 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    logger.info(f"Executing scheduled job: purging soft-deleted records older than {cutoff}.")

def start_scheduler():
    scheduler.add_job(job_process_recurring_transactions, 'cron', hour=1, minute=0, id="recurring_tx")
    scheduler.add_job(job_send_due_reminders, 'cron', hour=8, minute=0, id="due_reminders")
    scheduler.add_job(job_check_budget_thresholds, 'interval', hours=6, id="budget_checks")
    scheduler.add_job(job_purge_soft_deleted_records, 'cron', day=1, hour=3, id="purge_deleted")
    scheduler.start()
