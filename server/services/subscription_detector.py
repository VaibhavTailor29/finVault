"""
Subscription Detector & Price Hike Monitor:
Discovers repeating charges and alerts on cost increases.
"""
from typing import List, Dict, Any
from decimal import Decimal
from datetime import date
from collections import defaultdict

class SubscriptionDetector:
    @staticmethod
    def detect_recurring_subscriptions(expenses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Groups expenses by merchant/note and checks for recurring cadence
        (monthly: 28-31 days apart, weekly: 6-8 days apart).
        """
        merchant_groups = defaultdict(list)
        for exp in expenses:
            key = (exp.get("note") or "").strip().lower()
            if key and len(key) >= 3:
                merchant_groups[key].append(exp)

        detected = []
        for merchant, txs in merchant_groups.items():
            if len(txs) >= 2:
                sorted_txs = sorted(txs, key=lambda x: x["date"])
                intervals = []
                for i in range(1, len(sorted_txs)):
                    days = (sorted_txs[i]["date"] - sorted_txs[i-1]["date"]).days
                    intervals.append(days)

                avg_interval = sum(intervals) / len(intervals)
                cadence = "Monthly" if 25 <= avg_interval <= 35 else "Weekly" if 5 <= avg_interval <= 9 else "Yearly" if 350 <= avg_interval <= 380 else None
                
                if cadence:
                    last_amount = sorted_txs[-1]["amount"]
                    prev_amount = sorted_txs[-2]["amount"]
                    price_increased = last_amount > prev_amount

                    detected.append({
                        "merchant": merchant.title(),
                        "cadence": cadence,
                        "expected_amount": last_amount,
                        "previous_amount": prev_amount,
                        "price_increased": price_increased,
                        "price_increase_amount": (last_amount - prev_amount) if price_increased else Decimal("0.00"),
                        "last_charge_date": sorted_txs[-1]["date"]
                    })

        return detected
