"""
Credit Card Service: Utilization checks, billing cycle calculations, and transfer payments.
"""
from typing import List, Dict, Any
from decimal import Decimal
from datetime import date, datetime, timedelta

class CardService:
    @staticmethod
    def calculate_card_status(
        credit_limit: Decimal,
        charges: List[Dict[str, Any]],
        payments: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculates current outstanding balance, available credit, and utilization percentage.
        Charges increase outstanding balance.
        Payments decrease outstanding balance.
        """
        total_charges = sum((c["amount"] for c in charges), Decimal("0.00"))
        total_payments = sum((p["amount"] for p in payments), Decimal("0.00"))
        
        current_outstanding = max(Decimal("0.00"), total_charges - total_payments)
        available_credit = max(Decimal("0.00"), credit_limit - current_outstanding)
        
        utilization_pct = Decimal("0.00")
        if credit_limit > Decimal("0.00"):
            utilization_pct = (current_outstanding / credit_limit) * Decimal("100.00")
            
        status = "normal"
        if utilization_pct >= Decimal("70.00"):
            status = "alert"
        elif utilization_pct >= Decimal("30.00"):
            status = "warning"
            
        return {
            "credit_limit": credit_limit,
            "current_outstanding": current_outstanding,
            "available_credit": available_credit,
            "utilization_percentage": round(utilization_pct, 2),
            "status": status
        }
