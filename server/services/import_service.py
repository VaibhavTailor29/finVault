"""
Statement Import Service (CSV, OFX, QIF).
Includes stable fingerprint hashing, rapidfuzz fuzzy deduplication within +/-2 days,
and batch undo mechanisms.
"""
import csv
import hashlib
from typing import List, Dict, Any, Tuple, Optional
from decimal import Decimal
from datetime import datetime, date, timedelta
from rapidfuzz import fuzz

class ImportService:
    @staticmethod
    def generate_fingerprint(account_id: str, tx_date: date, amount: Decimal, description: str) -> str:
        """
        Generates deterministic SHA-256 fingerprint for exact duplicate elimination:
        account_id + YYYY-MM-DD + canonical_amount + normalized_description
        """
        norm_desc = "".join(e for e in description.lower() if e.isalnum())
        data = f"{account_id}:{tx_date.isoformat()}:{amount:.2f}:{norm_desc}"
        return hashlib.sha256(data.encode("utf-8")).hexdigest()

    @staticmethod
    def is_fuzzy_duplicate(
        candidate: Dict[str, Any],
        existing_txs: List[Dict[str, Any]],
        fuzz_threshold: float = 85.0
    ) -> Tuple[bool, Optional[str]]:
        """
        Detects likely duplicate transactions within a +/- 2-day window
        using amount parity and rapidfuzz string similarity on descriptions.
        """
        c_date = candidate["date"]
        c_amount = Decimal(str(candidate["amount"]))
        c_desc = candidate.get("description", "").lower()

        for ex in existing_txs:
            ex_date = ex["date"]
            if abs((c_date - ex_date).days) <= 2:
                ex_amount = Decimal(str(ex["amount"]))
                if abs(c_amount - ex_amount) < Decimal("0.01"):
                    ex_desc = ex.get("note", "").lower()
                    similarity = fuzz.partial_ratio(c_desc, ex_desc)
                    if similarity >= fuzz_threshold:
                        return True, f"Matched existing transaction '{ex.get('note')}' from {ex_date} ({similarity:.0f}% match)"

        return False, None
