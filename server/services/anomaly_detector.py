"""
Anomaly Detector: Uses robust statistics (IQR / Median Absolute Deviation)
to detect unusual spikes in spending per category and duplicate charges within 24 hours.
"""
from typing import List, Dict, Any
from decimal import Decimal
import numpy as np

class AnomalyDetector:
    @staticmethod
    def detect_category_outliers(category_expenses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Flags transactions exceeding Q3 + 1.5 * IQR for the specified category.
        """
        if len(category_expenses) < 5:
            return []

        amounts = [float(e["amount"]) for e in category_expenses]
        q75, q25 = np.percentile(amounts, [75, 25])
        iqr = q75 - q25
        threshold = q75 + (1.5 * iqr)

        outliers = []
        for exp in category_expenses:
            if float(exp["amount"]) > threshold:
                outliers.append({
                    "id": exp["id"],
                    "amount": exp["amount"],
                    "threshold": Decimal(f"{threshold:.2f}"),
                    "date": exp["date"],
                    "note": exp.get("note"),
                    "reason": f"Amount is unusually high compared to typical spend (threshold ₹{threshold:.2f})"
                })

        return outliers

    @staticmethod
    def detect_24h_duplicates(expenses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Flags charges with identical amount and note executed within 24 hours.
        """
        duplicates = []
        sorted_txs = sorted(expenses, key=lambda x: x["date"])

        for i in range(len(sorted_txs)):
            for j in range(i + 1, len(sorted_txs)):
                day_diff = abs((sorted_txs[j]["date"] - sorted_txs[i]["date"]).days)
                if day_diff > 1:
                    break
                if sorted_txs[i]["amount"] == sorted_txs[j]["amount"]:
                    desc_i = (sorted_txs[i].get("note") or "").lower().strip()
                    desc_j = (sorted_txs[j].get("note") or "").lower().strip()
                    if desc_i and desc_i == desc_j:
                        duplicates.append({
                            "tx_id_1": sorted_txs[i]["id"],
                            "tx_id_2": sorted_txs[j]["id"],
                            "amount": sorted_txs[i]["amount"],
                            "note": desc_i,
                            "date": sorted_txs[j]["date"]
                        })

        return duplicates
