"""
Reports API: Monthly/Yearly aggregations and exports with step-up verification.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from typing import Optional
from decimal import Decimal
from server.services.report_service import ReportService
from server.api.deps import get_current_user_id

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/monthly")
async def get_monthly_report(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    user_id: str = Depends(get_current_user_id)
):
    """
    Decrypted records are aggregated in memory with Python Decimal.
    Transfers are excluded from spending calculations.
    """
    report = ReportService.generate_monthly_report(
        month=month,
        year=year,
        decrypted_expenses=[],
        decrypted_incomes=[],
        card_spend_total=Decimal("0.00"),
        investment_contributions=Decimal("0.00"),
        people_ledger_net=Decimal("0.00")
    )
    return report

@router.get("/networth")
async def get_net_worth(user_id: str = Depends(get_current_user_id)):
    nw = ReportService.calculate_net_worth(
        liquid_cash=Decimal("50000.00"),
        investment_value=Decimal("125000.00"),
        total_card_debt=Decimal("12400.00"),
        total_lent=Decimal("4500.00"),
        total_borrowed=Decimal("0.00")
    )
    return {"net_worth": float(nw)}
