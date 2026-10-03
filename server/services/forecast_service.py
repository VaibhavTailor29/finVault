"""
Forecast & Safe-To-Spend Service:
Calculates daily safe-to-spend allowances and 30-60 day cash flow timelines.
"""
from typing import Dict, Any, List
from decimal import Decimal
from datetime import date, timedelta
import calendar

class ForecastService:
    @staticmethod
    def calculate_safe_to_spend(
        current_liquid_balance: Decimal,
        known_recurring_bills: Decimal,
        upcoming_card_dues: Decimal,
        days_remaining_in_month: int
    ) -> Dict[str, Any]:
        """
        Safe to Spend = (Liquid Cash - Pending Fixed Commitments) / Days Remaining.
        """
        fixed_obligations = known_recurring_bills + upcoming_card_dues
        free_discretionary = max(Decimal("0.00"), current_liquid_balance - fixed_obligations)
        
        days = max(1, days_remaining_in_month)
        daily_safe = free_discretionary / Decimal(str(days))

        return {
            "liquid_balance": current_liquid_balance,
            "fixed_obligations": fixed_obligations,
            "free_discretionary": free_discretionary,
            "days_remaining": days,
            "safe_to_spend_per_day": round(daily_safe, 2)
        }
