"""
Tests for Report Service Aggregations and Financial Mathematics.
"""
from decimal import Decimal
from datetime import date
from server.services.report_service import ReportService

def test_monthly_report_math():
    expenses = [
        {"id": "1", "amount": Decimal("1500.00"), "category_id": "c1", "category_name": "Food", "category_color": "#F59E0B", "date": date(2026, 10, 1)},
        {"id": "2", "amount": Decimal("500.00"), "category_id": "c2", "category_name": "Transit", "category_color": "#3B82F6", "date": date(2026, 10, 2)}
    ]
    incomes = [
        {"id": "3", "amount": Decimal("5000.00"), "source": "Salary", "date": date(2026, 10, 1)}
    ]

    report = ReportService.generate_monthly_report(
        month=10,
        year=2026,
        decrypted_expenses=expenses,
        decrypted_incomes=incomes,
        card_spend_total=Decimal("0.00"),
        investment_contributions=Decimal("0.00"),
        people_ledger_net=Decimal("0.00")
    )

    assert report["total_income"] == 5000.00
    assert report["total_expense"] == 2000.00
    assert report["net_savings"] == 3000.00
    assert report["savings_rate"] == 60.00

def test_net_worth_math():
    nw = ReportService.calculate_net_worth(
        liquid_cash=Decimal("10000.00"),
        investment_value=Decimal("50000.00"),
        total_card_debt=Decimal("4000.00"),
        total_lent=Decimal("2000.00"),
        total_borrowed=Decimal("1000.00")
    )
    # 10000 + 50000 + 2000 - 4000 - 1000 = 57000
    assert nw == Decimal("57000.00")
