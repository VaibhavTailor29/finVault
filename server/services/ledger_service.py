"""
LedgerService: Person debt running balances and spent-on-people aggregation.
"""
from typing import List, Dict, Any
from decimal import Decimal

class LedgerService:
    @staticmethod
    def calculate_person_balance(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculates net balance for a person:
        - 'lent': increases amount owed TO me (+ amount)
        - 'borrowed': increases amount owed BY me (- amount)
        - 'settlement': reduces outstanding debt towards zero
        """
        net = Decimal("0.00")
        total_lent = Decimal("0.00")
        total_borrowed = Decimal("0.00")
        
        for entry in entries:
            amt = entry["amount"]
            etype = entry["type"].lower()
            if etype == "lent":
                net += amt
                total_lent += amt
            elif etype == "borrowed":
                net -= amt
                total_borrowed += amt
            elif etype == "settlement":
                # If they paid me back
                if entry.get("direction") == "they_paid" or net > Decimal("0.00"):
                    net -= amt
                else:
                    net += amt

        return {
            "net_balance": net,
            "total_lent": total_lent,
            "total_borrowed": total_borrowed,
            "is_settled": net == Decimal("0.00")
        }
