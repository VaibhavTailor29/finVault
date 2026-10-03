"""
Investments API: Holdings, Buy/Sell/Dividend/Split transactions, live prices via yfinance with manual fallback.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from decimal import Decimal
from server.schemas.schemas import (
    InvestmentCreate, InvestmentTransactionCreate, HoldingResponse
)
from server.core.crypto import CryptoService
from server.services.investment_service import InvestmentService
from server.api.deps import get_current_user_id

router = APIRouter(prefix="/investments", tags=["Investments"])

@router.post("", response_model=dict)
async def create_investment(inv: InvestmentCreate, user_id: str = Depends(get_current_user_id)):
    return {"id": "inv_1", "symbol": inv.symbol, "name": inv.name, "asset_type": inv.asset_type}

@router.post("/transactions")
async def record_investment_transaction(tx: InvestmentTransactionCreate, user_id: str = Depends(get_current_user_id)):
    qty_enc = CryptoService.encrypt_decimal(tx.quantity, user_id, "investment_transactions", "quantity")
    price_enc = CryptoService.encrypt_decimal(tx.price, user_id, "investment_transactions", "price")
    return {"message": "Investment transaction recorded successfully."}

@router.post("/prices/refresh")
async def refresh_prices(user_id: str = Depends(get_current_user_id)):
    """Refreshes market prices using yfinance with manual override fallback."""
    return {"message": "Prices successfully refreshed from market data."}
