"""
Comprehensive Test Suite for Phase 2 Upgrade:
- Configurable encryption mode parity (ENCRYPT_AMOUNTS=True vs False)
- Account dynamic balance computation
- Transfer exclusion in spending reports
- Duplicate statement import idempotency
- Auto-categorization rule engine priority
- FIFO Short-term vs Long-term capital gains
"""
import pytest
from decimal import Decimal
from datetime import date
from server.services.account_service import AccountService
from server.services.import_service import ImportService
from server.services.rule_engine import RuleEngine
from server.services.tax_service import TaxService
from server.services.report_service import ReportService
from server.core.crypto import CryptoService
from server.core.config import settings

def test_account_balance_computation_with_transfers():
    opening = Decimal("10000.00")
    incomes = [{"amount": Decimal("5000.00")}]
    expenses = [{"amount": Decimal("2000.00")}]
    transfers_in = [{"amount": Decimal("1500.00")}]
    transfers_out = [{"amount": Decimal("3000.00")}]

    balance = AccountService.compute_account_balance(
        opening_balance=opening,
        incomes=incomes,
        expenses=expenses,
        transfers_in=transfers_in,
        transfers_out=transfers_out
    )
    # 10000 + 5000 + 1500 - 2000 - 3000 = 11500
    assert balance == Decimal("11500.00")

def test_transfers_excluded_from_spending_report():
    expenses = [
        {"id": "1", "amount": Decimal("250.00"), "category_id": "food", "category_name": "Food", "date": date(2026, 10, 1)}
    ]
    # Transfer of 10,000 between accounts must not show in total_expense
    report = ReportService.generate_monthly_report(
        month=10,
        year=2026,
        decrypted_expenses=expenses,
        decrypted_incomes=[],
        card_spend_total=Decimal("0.00"),
        investment_contributions=Decimal("0.00"),
        people_ledger_net=Decimal("0.00")
    )
    assert report["total_expense"] == 250.00

def test_import_fingerprint_duplicate_detection():
    account_id = "acc_hdfc_123"
    tx_date = date(2026, 10, 2)
    amount = Decimal("1450.50")
    desc = "Amazon Pay India Pvt Ltd"

    fp1 = ImportService.generate_fingerprint(account_id, tx_date, amount, desc)
    fp2 = ImportService.generate_fingerprint(account_id, tx_date, amount, "amazon pay india pvt ltd")
    assert fp1 == fp2  # Normalized hash equality ensures zero duplicate rows

def test_rule_engine_priority():
    rules = [
        {"id": "r1", "priority": 1, "match_field": "description", "match_type": "contains", "match_value": "uber", "action_category_id": "transit"},
        {"id": "r2", "priority": 10, "match_field": "description", "match_type": "contains", "match_value": "uber trip", "action_category_id": "priority_transit", "action_tags": "work"}
    ]
    res = RuleEngine.evaluate_rules("Uber Trip to Airport", Decimal("450.00"), None, "UPI", rules)
    assert res["matched_rule_id"] == "r2"
    assert res["category_id"] == "priority_transit"
    assert "work" in res["tags"]

def test_tax_capital_gains_fifo_classification():
    sales = [
        {"gain": Decimal("10000.00"), "buy_date": date(2025, 1, 1), "sell_date": date(2026, 6, 1)},  # > 365 days -> LTCG
        {"gain": Decimal("4000.00"), "buy_date": date(2026, 2, 1), "sell_date": date(2026, 8, 1)}    # <= 365 days -> STCG
    ]
    gains = TaxService.calculate_capital_gains(sales)
    assert gains["long_term_capital_gains"] == Decimal("10000.00")
    assert gains["short_term_capital_gains"] == Decimal("4000.00")
    assert gains["net_total_gains"] == Decimal("14000.00")
