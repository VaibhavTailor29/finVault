"""
Tax Helper & Capital Gains Service (India FY April-March).
Calculates section 80C, 80D, 80CCD, NPS deductions and STCG/LTCG estimates from FIFO sells.
"""
from typing import List, Dict, Any
from decimal import Decimal
from datetime import date

# Config-driven deduction limits (Source: Income Tax Act, 1961 - FY 2024-25/2025-26)
DEFAULT_TAX_LIMITS = {
    "80C": Decimal("150000.00"),  # PPF, ELSS, EPF, Life Insurance
    "80D": Decimal("25000.00"),   # Health Insurance self & family
    "80CCD_1B": Decimal("50000.00"), # NPS additional deduction
    "Standard": Decimal("75000.00")
}

class TaxService:
    @staticmethod
    def calculate_section_deductions(
        tagged_items: List[Dict[str, Any]],
        custom_limits: Dict[str, Decimal] = None
    ) -> Dict[str, Any]:
        limits = custom_limits or DEFAULT_TAX_LIMITS
        claimed = {sec: Decimal("0.00") for sec in limits}

        for item in tagged_items:
            sec = item.get("tax_section")
            if sec in claimed:
                claimed[sec] += item["amount"]

        results = {}
        total_eligible = Decimal("0.00")
        for sec, cap in limits.items():
            amt = claimed[sec]
            allowed = min(amt, cap)
            total_eligible += allowed
            results[sec] = {
                "claimed": amt,
                "limit": cap,
                "allowed": allowed,
                "headroom": max(Decimal("0.00"), cap - amt)
            }

        return {"sections": results, "total_allowed_deductions": total_eligible}

    @staticmethod
    def calculate_capital_gains(
        sales_with_lots: List[Dict[str, Any]],
        holding_period_days_threshold: int = 365
    ) -> Dict[str, Any]:
        """
        Classifies realized gains from FIFO sell transactions into:
        - STCG (Short-Term Capital Gains): held <= 365 days (for listed equity)
        - LTCG (Long-Term Capital Gains): held > 365 days
        """
        stcg = Decimal("0.00")
        ltcg = Decimal("0.00")

        for sale in sales_with_lots:
            gain = sale["gain"]
            held_days = (sale["sell_date"] - sale["buy_date"]).days
            if held_days > holding_period_days_threshold:
                ltcg += gain
            else:
                stcg += gain

        return {
            "short_term_capital_gains": stcg,
            "long_term_capital_gains": ltcg,
            "net_total_gains": stcg + ltcg,
            "disclaimer": "This is an automated estimate based on FIFO transaction logs and does not constitute formal tax advice."
        }
