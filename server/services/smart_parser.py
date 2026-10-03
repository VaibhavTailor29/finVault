"""
Smart Natural-Language Parser for Quick Add.
Deterministic regex + dateparser + rapidfuzz against user's categories & contacts.
Never sends data to external cloud LLMs.
"""
import re
from typing import Dict, Any, List, Optional
from decimal import Decimal
from datetime import date, datetime
import dateparser
from rapidfuzz import process, fuzz

PAYMENT_METHODS = ["Cash", "UPI", "Debit Card", "Credit Card", "Net Banking", "Wallet"]

class SmartParser:
    @staticmethod
    def parse_query(
        text: str,
        user_categories: List[Dict[str, Any]],
        user_people: List[Dict[str, Any]],
        user_tags: List[str]
    ) -> Dict[str, Any]:
        """
        Parses text like '250 lunch with Ravi UPI yesterday' into:
        amount: 250, note: 'lunch with Ravi', category_id: ..., person_id: ..., method: 'UPI', date: ...
        """
        clean_text = text.strip()
        result = {
            "amount": Decimal("0.00"),
            "category_id": None,
            "person_id": None,
            "payment_method": "UPI",
            "date": date.today(),
            "note": clean_text,
            "tags": [],
            "confidence": 0.8
        }

        # 1. Extract Amount (e.g. 250, ₹450, 120.50, rs 500)
        amt_match = re.search(r"(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)", clean_text, re.IGNORECASE)
        if amt_match:
            try:
                result["amount"] = Decimal(amt_match.group(1))
            except Exception:
                pass

        # 2. Extract Date via dateparser (e.g. yesterday, today, 25 Sep, last monday)
        parsed_dt = dateparser.parse(clean_text, settings={"PREFER_DATES_FROM": "past"})
        if parsed_dt:
            result["date"] = parsed_dt.date()

        # 3. Match Payment Method
        for pm in PAYMENT_METHODS:
            if re.search(rf"\b{pm}\b", clean_text, re.IGNORECASE):
                result["payment_method"] = pm
                break

        # 4. Fuzzy match Person (e.g. 'with Ravi')
        person_names = [p["name"] for p in user_people]
        if person_names:
            best_person = process.extractOne(clean_text, person_names, scorer=fuzz.partial_ratio)
            if best_person and best_person[1] >= 80:
                match = next((p for p in user_people if p["name"] == best_person[0]), None)
                if match:
                    result["person_id"] = match["id"]

        # 5. Fuzzy match Category
        cat_names = [c["name"] for c in user_categories]
        if cat_names:
            best_cat = process.extractOne(clean_text, cat_names, scorer=fuzz.partial_ratio)
            if best_cat and best_cat[1] >= 75:
                match = next((c for c in user_categories if c["name"] == best_cat[0]), None)
                if match:
                    result["category_id"] = match["id"]

        return result
