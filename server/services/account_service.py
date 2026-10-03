"""
AccountService: Computes real-time balances from immutable transaction logs.
Balance = opening_balance + income - expenses + transfers_in - transfers_out.
Includes account reconciliation and adjustment transactions.
"""
from typing import List, Dict, Any, Optional
from decimal import Decimal
from datetime import datetime, timezone

class AccountService:
    @staticmethod
    def compute_account_balance(
        opening_balance: Decimal,
        incomes: List[Dict[str, Any]],
        expenses: List[Dict[str, Any]],
        transfers_in: List[Dict[str, Any]],
        transfers_out: List[Dict[str, Any]]
    ) -> Decimal:
        """
        Dynamically computes current balance from transaction records.
        Ensures balances are never mutable stored state that can drift.
        """
        total_income = sum((i["amount"] for i in incomes if not i.get("is_deleted")), Decimal("0.0000"))
        total_expense = sum((e["amount"] for e in expenses if not e.get("is_deleted")), Decimal("0.0000"))
        total_transfers_in = sum((t["amount"] for t in transfers_in if not t.get("is_deleted")), Decimal("0.0000"))
        total_transfers_out = sum((t["amount"] for t in transfers_out if not t.get("is_deleted")), Decimal("0.0000"))

        return (opening_balance + total_income + total_transfers_in) - (total_expense + total_transfers_out)

    @staticmethod
    def calculate_reconciliation_difference(
        computed_balance: Decimal,
        actual_statement_balance: Decimal
    ) -> Dict[str, Any]:
        """
        Calculates discrepancy between calculated ledger and bank statement.
        """
        diff = actual_statement_balance - computed_balance
        return {
            "computed_balance": computed_balance,
            "actual_statement_balance": actual_statement_balance,
            "difference": diff,
            "is_matched": diff == Decimal("0.0000"),
            "suggested_adjustment_type": "income" if diff > 0 else "expense"
        }
