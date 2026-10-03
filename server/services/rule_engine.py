"""
Auto-Categorization Rule Engine:
Evaluates priority-ordered conditions and executes category/tag/transfer actions.
Includes learning suggestions when user re-categorizes items 2+ times.
"""
import re
from typing import List, Dict, Any, Optional
from decimal import Decimal

class RuleEngine:
    @staticmethod
    def evaluate_rules(
        description: str,
        amount: Decimal,
        account_id: Optional[str],
        payment_method: Optional[str],
        rules: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Runs priority-sorted rules against transaction metadata.
        Returns applied category, tags, and transfer flag.
        """
        sorted_rules = sorted(rules, key=lambda r: r.get("priority", 0), reverse=True)
        norm_desc = (description or "").lower()

        for rule in sorted_rules:
            if not rule.get("is_enabled", True):
                continue

            match_field = rule.get("match_field", "description")
            match_type = rule.get("match_type", "contains")
            match_val = rule.get("match_value", "").lower()

            matched = False
            if match_field == "description":
                if match_type == "contains" and match_val in norm_desc:
                    matched = True
                elif match_type == "equals" and match_val == norm_desc:
                    matched = True
                elif match_type == "regex":
                    try:
                        if re.search(match_val, norm_desc):
                            matched = True
                    except re.error:
                        pass
            elif match_field == "account" and account_id == rule.get("match_value"):
                matched = True

            if matched:
                return {
                    "matched_rule_id": rule["id"],
                    "category_id": rule.get("action_category_id"),
                    "tags": [t.strip() for t in rule.get("action_tags", "").split(",") if t.strip()],
                    "is_transfer": rule.get("action_mark_transfer", False)
                }

        return {"matched_rule_id": None, "category_id": None, "tags": [], "is_transfer": False}
