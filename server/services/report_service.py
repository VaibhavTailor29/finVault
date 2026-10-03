"""
ReportService: Aggregates decrypted records using Decimal precision.
Transfers (card payments, debt settlements, investment funding) are strictly excluded from spending.
"""
from typing import List, Dict, Any
from decimal import Decimal
from datetime import date
from collections import defaultdict

class ReportService:
    @staticmethod
    def generate_monthly_report(
        month: int,
        year: int,
        decrypted_expenses: List[Dict[str, Any]],
        decrypted_incomes: List[Dict[str, Any]],
        card_spend_total: Decimal,
        investment_contributions: Decimal,
        people_ledger_net: Decimal
    ) -> Dict[str, Any]:
        """
        Calculates monthly financial breakdown using exact Decimal math.
        All input expenses and incomes are already validated and decrypted for user_id.
        """
        # Sum total income for the month
        total_income = Decimal("0.00")
        for inc in decrypted_incomes:
            total_income += inc["amount"]

        # Sum total operating expenses (transfers/card payments are excluded)
        total_expense = Decimal("0.00")
        category_map = defaultdict(lambda: {"amount": Decimal("0.00"), "count": 0, "name": "", "color": "#6366F1"})
        daily_map = defaultdict(Decimal)
        
        for exp in decrypted_expenses:
            amt = exp["amount"]
            total_expense += amt
            cat_id = exp.get("category_id") or "other"
            cat_name = exp.get("category_name", "Other")
            cat_color = exp.get("category_color", "#6366F1")
            
            category_map[cat_id]["amount"] += amt
            category_map[cat_id]["count"] += 1
            category_map[cat_id]["name"] = cat_name
            category_map[cat_id]["color"] = cat_color

            day_str = exp["date"].strftime("%d %b") if hasattr(exp["date"], "strftime") else str(exp["date"])
            daily_map[day_str] += amt

        # Net savings & savings rate
        net_savings = total_income - total_expense
        savings_rate = Decimal("0.00")
        if total_income > Decimal("0.00"):
            savings_rate = (net_savings / total_income) * Decimal("100.00")

        # Category breakdown with percentages
        category_breakdown = []
        for cat_id, data in category_map.items():
            pct = Decimal("0.00")
            if total_expense > Decimal("0.00"):
                pct = (data["amount"] / total_expense) * Decimal("100.00")
            category_breakdown.append({
                "category_id": cat_id,
                "name": data["name"],
                "color": data["color"],
                "amount": float(data["amount"]),
                "percentage": round(float(pct), 2),
                "count": data["count"]
            })
        category_breakdown.sort(key=lambda x: x["amount"], reverse=True)

        # Top 5 highest expenses
        sorted_expenses = sorted(decrypted_expenses, key=lambda x: x["amount"], reverse=True)
        top_expenses = [
            {
                "id": e["id"],
                "note": e.get("note", "Expense"),
                "amount": float(e["amount"]),
                "date": str(e["date"]),
                "category_name": e.get("category_name", "General")
            }
            for e in sorted_expenses[:5]
        ]

        # Daily spending array
        daily_spending = [
            {"date": day, "amount": float(amt)}
            for day, amt in sorted(daily_map.items())
        ]

        return {
            "month": month,
            "year": year,
            "total_income": float(total_income),
            "total_expense": float(total_expense),
            "net_savings": float(net_savings),
            "savings_rate": round(float(savings_rate), 2),
            "category_breakdown": category_breakdown,
            "top_expenses": top_expenses,
            "daily_spending": daily_spending,
            "credit_card_spend": float(card_spend_total),
            "investment_contributions": float(investment_contributions),
            "people_ledger_net": float(people_ledger_net)
        }

    @staticmethod
    def calculate_net_worth(
        liquid_cash: Decimal,
        investment_value: Decimal,
        total_card_debt: Decimal,
        total_lent: Decimal,
        total_borrowed: Decimal
    ) -> Decimal:
        """
        Net worth formula:
        Net Worth = Cash/Savings + Investment Value + Lent (Receivables) - Card Outstanding (Dues) - Borrowed (Payables)
        """
        return (liquid_cash + investment_value + total_lent) - (total_card_debt + total_borrowed)
