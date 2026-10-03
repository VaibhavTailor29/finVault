"""
InvestmentService: FIFO Realized P&L, Average Cost Basis, and Portfolio Aggregations.
"""
from typing import List, Dict, Any
from decimal import Decimal
from collections import deque

class InvestmentService:
    @staticmethod
    def calculate_holding_metrics(transactions: List[Dict[str, Any]], current_price: Decimal) -> Dict[str, Any]:
        """
        Calculates quantity, average cost basis, realized P&L using FIFO, and unrealized P&L.
        Each tx has: type ('BUY', 'SELL', 'DIVIDEND', 'SPLIT'), quantity, price, fees, date.
        """
        # Sort chronologically
        sorted_txs = sorted(transactions, key=lambda x: x["date"])
        
        buy_lots = deque()  # stores (remaining_qty, price_per_unit)
        total_qty = Decimal("0.0000")
        total_invested_remaining = Decimal("0.0000")
        realized_pnl = Decimal("0.0000")
        total_dividends = Decimal("0.0000")

        for tx in sorted_txs:
            tx_type = tx["type"].upper()
            qty = Decimal(str(tx["quantity"]))
            price = Decimal(str(tx["price"]))
            fees = Decimal(str(tx.get("fees", "0.00") or "0.00"))

            if tx_type == "BUY":
                buy_lots.append([qty, price])
                total_qty += qty
                total_invested_remaining += (qty * price) + fees

            elif tx_type == "SELL":
                qty_to_sell = qty
                sale_proceeds = (qty * price) - fees
                cost_of_sold_lots = Decimal("0.0000")

                while qty_to_sell > Decimal("0.0000") and buy_lots:
                    first_lot = buy_lots[0]
                    lot_qty, lot_price = first_lot

                    if lot_qty <= qty_to_sell:
                        cost_of_sold_lots += lot_qty * lot_price
                        qty_to_sell -= lot_qty
                        buy_lots.popleft()
                    else:
                        cost_of_sold_lots += qty_to_sell * lot_price
                        first_lot[0] -= qty_to_sell
                        qty_to_sell = Decimal("0.0000")

                trade_realized_pnl = sale_proceeds - cost_of_sold_lots
                realized_pnl += trade_realized_pnl
                total_qty -= qty
                total_invested_remaining = max(Decimal("0.0000"), total_invested_remaining - cost_of_sold_lots)

            elif tx_type == "SPLIT":
                # Price is split ratio e.g. 2 for 2:1 split
                ratio = price if price > Decimal("0.00") else Decimal("1.00")
                total_qty = total_qty * ratio
                for lot in buy_lots:
                    lot[0] = lot[0] * ratio
                    lot[1] = lot[1] / ratio

            elif tx_type == "DIVIDEND":
                div_amount = (qty * price)
                total_dividends += div_amount

        # Compute average buy price
        avg_buy_price = Decimal("0.0000")
        if total_qty > Decimal("0.0000"):
            avg_buy_price = total_invested_remaining / total_qty

        current_value = total_qty * current_price
        unrealized_pnl = current_value - total_invested_remaining
        unrealized_pnl_pct = Decimal("0.00")
        if total_invested_remaining > Decimal("0.0000"):
            unrealized_pnl_pct = (unrealized_pnl / total_invested_remaining) * Decimal("100.00")

        return {
            "quantity": total_qty,
            "avg_buy_price": avg_buy_price,
            "invested_amount": total_invested_remaining,
            "current_price": current_price,
            "current_value": current_value,
            "unrealized_pnl": unrealized_pnl,
            "unrealized_pnl_pct": round(unrealized_pnl_pct, 2),
            "realized_pnl": realized_pnl,
            "total_dividends": total_dividends
        }
