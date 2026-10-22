"""
Investments API: Holdings, Buy/Sell/Dividend/Split transactions, live prices with PostgreSQL persistence.
Zero default or mock data - clean database state.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional, Dict, Any
from decimal import Decimal
import uuid
from datetime import date, datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc

from server.schemas.schemas import (
    InvestmentCreate, InvestmentUpdate, InvestmentResponse,
    InvestmentTransactionCreate, InvestmentTransactionResponse, HoldingResponse,
    BulkImportRequest, BulkImportResponse, BrokerSyncRequest, BrokerSyncResponse,
    LivePricesRequest, HoldingImportItem
)
from server.models.models import Investment, InvestmentTransaction, PriceCache
from server.core.crypto import CryptoService
from server.services.investment_service import InvestmentService
from server.services.broker_sync_service import BrokerSyncService
from server.services.market_data_service import MarketDataService
from server.api.deps import get_current_user_id, get_db

router = APIRouter(prefix="/investments", tags=["Investments"])

@router.get("", response_model=List[InvestmentResponse])
async def list_investments(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve all non-deleted investments for the current user from PostgreSQL."""
    result = await db.execute(
        select(Investment).where(and_(Investment.user_id == user_id, Investment.is_deleted == False))
    )
    investments = result.scalars().all()
    response = []
    for inv in investments:
        notes = CryptoService.decrypt(inv.notes_encrypted, user_id, "investments", "notes") if inv.notes_encrypted else None
        response.append(InvestmentResponse(
            id=inv.id,
            symbol=inv.symbol,
            name=inv.name,
            asset_type=inv.asset_type,
            institution=inv.institution,
            interest_rate=inv.interest_rate,
            maturity_date=inv.maturity_date,
            tenure_years=inv.tenure_years,
            compounding_frequency=inv.compounding_frequency,
            monthly_deposit=inv.monthly_deposit,
            sip_day=inv.sip_day,
            payout_frequency=inv.payout_frequency,
            credit_rating=inv.credit_rating,
            category_tag=inv.category_tag,
            units_or_grams=inv.units_or_grams,
            is_sip_active=inv.is_sip_active if inv.is_sip_active is not None else True,
            tax_section=inv.tax_section,
            notes=notes
        ))
    return response

@router.post("", response_model=InvestmentResponse, status_code=status.HTTP_201_CREATED)
async def create_investment(
    inv: InvestmentCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Create a new investment entry in PostgreSQL with zero-knowledge encrypted notes."""
    inv_id = inv.id or f"inv_{uuid.uuid4().hex[:12]}"
    notes_enc = CryptoService.encrypt(inv.notes, user_id, "investments", "notes") if inv.notes else None
    
    new_inv = Investment(
        id=inv_id,
        user_id=user_id,
        symbol=inv.symbol.strip().upper(),
        name=inv.name.strip(),
        asset_type=inv.asset_type,
        institution=inv.institution,
        interest_rate=inv.interest_rate,
        maturity_date=inv.maturity_date,
        tenure_years=inv.tenure_years,
        compounding_frequency=inv.compounding_frequency,
        monthly_deposit=inv.monthly_deposit,
        sip_day=inv.sip_day,
        payout_frequency=inv.payout_frequency,
        credit_rating=inv.credit_rating,
        category_tag=inv.category_tag,
        units_or_grams=inv.units_or_grams,
        is_sip_active=inv.is_sip_active if inv.is_sip_active is not None else True,
        tax_section=inv.tax_section,
        notes_encrypted=notes_enc,
        is_deleted=False
    )
    db.add(new_inv)
    await db.commit()
    await db.refresh(new_inv)

    return InvestmentResponse(
        id=new_inv.id,
        symbol=new_inv.symbol,
        name=new_inv.name,
        asset_type=new_inv.asset_type,
        institution=new_inv.institution,
        interest_rate=new_inv.interest_rate,
        maturity_date=new_inv.maturity_date,
        tenure_years=new_inv.tenure_years,
        compounding_frequency=new_inv.compounding_frequency,
        monthly_deposit=new_inv.monthly_deposit,
        sip_day=new_inv.sip_day,
        payout_frequency=new_inv.payout_frequency,
        credit_rating=new_inv.credit_rating,
        category_tag=new_inv.category_tag,
        units_or_grams=new_inv.units_or_grams,
        is_sip_active=new_inv.is_sip_active,
        tax_section=new_inv.tax_section,
        notes=inv.notes
    )

@router.put("/{investment_id}", response_model=InvestmentResponse)
async def update_investment(
    investment_id: str,
    update_data: InvestmentUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Update investment properties in PostgreSQL."""
    res = await db.execute(
        select(Investment).where(and_(Investment.id == investment_id, Investment.user_id == user_id, Investment.is_deleted == False))
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investment not found")

    if update_data.symbol is not None:
        inv.symbol = update_data.symbol.strip().upper()
    if update_data.name is not None:
        inv.name = update_data.name.strip()
    if update_data.asset_type is not None:
        inv.asset_type = update_data.asset_type
    if update_data.institution is not None:
        inv.institution = update_data.institution
    if update_data.interest_rate is not None:
        inv.interest_rate = update_data.interest_rate
    if update_data.maturity_date is not None:
        inv.maturity_date = update_data.maturity_date
    if update_data.tenure_years is not None:
        inv.tenure_years = update_data.tenure_years
    if update_data.compounding_frequency is not None:
        inv.compounding_frequency = update_data.compounding_frequency
    if update_data.monthly_deposit is not None:
        inv.monthly_deposit = update_data.monthly_deposit
    if update_data.sip_day is not None:
        inv.sip_day = update_data.sip_day
    if update_data.payout_frequency is not None:
        inv.payout_frequency = update_data.payout_frequency
    if update_data.credit_rating is not None:
        inv.credit_rating = update_data.credit_rating
    if update_data.category_tag is not None:
        inv.category_tag = update_data.category_tag
    if update_data.units_or_grams is not None:
        inv.units_or_grams = update_data.units_or_grams
    if update_data.is_sip_active is not None:
        inv.is_sip_active = update_data.is_sip_active
    if update_data.tax_section is not None:
        inv.tax_section = update_data.tax_section
    if update_data.notes is not None:
        inv.notes_encrypted = CryptoService.encrypt(update_data.notes, user_id, "investments", "notes")

    await db.commit()
    await db.refresh(inv)

    notes = CryptoService.decrypt(inv.notes_encrypted, user_id, "investments", "notes") if inv.notes_encrypted else None
    return InvestmentResponse(
        id=inv.id,
        symbol=inv.symbol,
        name=inv.name,
        asset_type=inv.asset_type,
        institution=inv.institution,
        interest_rate=inv.interest_rate,
        maturity_date=inv.maturity_date,
        tenure_years=inv.tenure_years,
        compounding_frequency=inv.compounding_frequency,
        monthly_deposit=inv.monthly_deposit,
        sip_day=inv.sip_day,
        payout_frequency=inv.payout_frequency,
        credit_rating=inv.credit_rating,
        category_tag=inv.category_tag,
        units_or_grams=inv.units_or_grams,
        is_sip_active=inv.is_sip_active,
        tax_section=inv.tax_section,
        notes=notes
    )

@router.delete("/{investment_id}")
async def delete_investment(
    investment_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Soft delete an investment from PostgreSQL."""
    res = await db.execute(
        select(Investment).where(and_(Investment.id == investment_id, Investment.user_id == user_id, Investment.is_deleted == False))
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investment not found")

    inv.is_deleted = True
    await db.commit()
    return {"success": True, "message": "Investment deleted successfully"}

@router.get("/transactions", response_model=List[InvestmentTransactionResponse])
async def list_transactions(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve all investment transactions for current user, decrypted from PostgreSQL."""
    res = await db.execute(
        select(InvestmentTransaction).where(InvestmentTransaction.user_id == user_id).order_by(InvestmentTransaction.date.desc())
    )
    txs = res.scalars().all()
    results = []
    for tx in txs:
        qty = CryptoService.decrypt_decimal(tx.quantity_encrypted, user_id, "investment_transactions", "quantity")
        price = CryptoService.decrypt_decimal(tx.price_encrypted, user_id, "investment_transactions", "price")
        fees = CryptoService.decrypt_decimal(tx.fees_encrypted or "0.00", user_id, "investment_transactions", "fees") if tx.fees_encrypted else Decimal("0.00")
        notes = CryptoService.decrypt(tx.notes_encrypted, user_id, "investment_transactions", "notes") if tx.notes_encrypted else None
        results.append(InvestmentTransactionResponse(
            id=tx.id,
            investment_id=tx.investment_id,
            type=tx.type,
            quantity=float(qty),
            price=float(price),
            fees=float(fees),
            date=str(tx.date),
            notes=notes
        ))
    return results

@router.post("/transactions", response_model=InvestmentTransactionResponse, status_code=status.HTTP_201_CREATED)
async def record_investment_transaction(
    tx: InvestmentTransactionCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Record an investment transaction with zero-knowledge AES-256 encrypted fields in PostgreSQL."""
    # Verify investment exists
    res = await db.execute(
        select(Investment).where(and_(Investment.id == tx.investment_id, Investment.user_id == user_id, Investment.is_deleted == False))
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investment not found")

    tx_id = tx.id or f"tx_{uuid.uuid4().hex[:12]}"
    qty_enc = CryptoService.encrypt_decimal(tx.quantity, user_id, "investment_transactions", "quantity")
    price_enc = CryptoService.encrypt_decimal(tx.price, user_id, "investment_transactions", "price")
    fees_enc = CryptoService.encrypt_decimal(tx.fees, user_id, "investment_transactions", "fees")
    notes_enc = CryptoService.encrypt(tx.notes, user_id, "investment_transactions", "notes") if tx.notes else None

    new_tx = InvestmentTransaction(
        id=tx_id,
        user_id=user_id,
        investment_id=tx.investment_id,
        type=tx.type.upper(),
        quantity_encrypted=qty_enc,
        price_encrypted=price_enc,
        fees_encrypted=fees_enc,
        date=tx.date,
        notes_encrypted=notes_enc
    )
    db.add(new_tx)
    await db.commit()
    await db.refresh(new_tx)

    return InvestmentTransactionResponse(
        id=new_tx.id,
        investment_id=new_tx.investment_id,
        type=new_tx.type,
        quantity=float(tx.quantity),
        price=float(tx.price),
        fees=float(tx.fees),
        date=str(new_tx.date),
        notes=tx.notes
    )

@router.delete("/transactions/{transaction_id}")
async def delete_investment_transaction(
    transaction_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Delete an investment transaction from PostgreSQL."""
    res = await db.execute(
        select(InvestmentTransaction).where(and_(InvestmentTransaction.id == transaction_id, InvestmentTransaction.user_id == user_id))
    )
    tx = res.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    await db.delete(tx)
    await db.commit()
    return {"success": True, "message": "Transaction deleted successfully"}

@router.post("/import/bulk", response_model=BulkImportResponse)
async def bulk_import_holdings(
    req: BulkImportRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Bulk imports original holdings from broker CSV/statements or manual list."""
    if not req.holdings:
        return BulkImportResponse(success=True, imported_count=0, message="No holdings provided for import.")

    # If replace mode, soft delete existing active investments
    if req.mode == "replace":
        existing_res = await db.execute(
            select(Investment).where(and_(Investment.user_id == user_id, Investment.is_deleted == False))
        )
        for old_inv in existing_res.scalars().all():
            old_inv.is_deleted = True

    imported_count = 0
    today_date = date.today()

    for item in req.holdings:
        sym = item.symbol.strip().upper()
        if not sym or item.quantity <= 0:
            continue

        # Check if already exists for user
        res = await db.execute(
            select(Investment).where(and_(Investment.user_id == user_id, Investment.symbol == sym, Investment.is_deleted == False))
        )
        inv = res.scalar_one_or_none()

        if not inv:
            inv_id = f"inv_{uuid.uuid4().hex[:12]}"
            notes_enc = CryptoService.encrypt(item.notes, user_id, "investments", "notes") if item.notes else None
            inv = Investment(
                id=inv_id,
                user_id=user_id,
                symbol=sym,
                name=item.name.strip() or sym,
                asset_type=item.asset_type or "Stocks",
                institution=item.institution,
                category_tag=item.category_tag,
                tax_section=item.tax_section,
                notes_encrypted=notes_enc,
                is_deleted=False
            )
            db.add(inv)
        else:
            if item.name and item.name.strip():
                inv.name = item.name.strip()
            if item.asset_type:
                inv.asset_type = item.asset_type
            if item.institution:
                inv.institution = item.institution
            if item.category_tag:
                inv.category_tag = item.category_tag

        # Record initial BUY transaction representing the holding cost basis
        tx_id = f"tx_{uuid.uuid4().hex[:12]}"
        qty_dec = Decimal(str(round(item.quantity, 4)))
        price_dec = Decimal(str(round(item.avg_buy_price, 2)))
        tx = InvestmentTransaction(
            id=tx_id,
            user_id=user_id,
            investment_id=inv.id,
            type="BUY",
            quantity_encrypted=CryptoService.encrypt_decimal(qty_dec, user_id, "investment_transactions", "quantity"),
            price_encrypted=CryptoService.encrypt_decimal(price_dec, user_id, "investment_transactions", "price"),
            fees_encrypted=CryptoService.encrypt_decimal(Decimal("0.00"), user_id, "investment_transactions", "fees"),
            date=today_date,
            notes_encrypted=CryptoService.encrypt(f"Imported holding basis ({item.institution or 'Broker'})", user_id, "investment_transactions", "notes")
        )
        db.add(tx)

        # Update PriceCache if current_price provided
        if item.current_price and item.current_price > 0:
            pc_res = await db.execute(select(PriceCache).where(PriceCache.symbol == sym))
            cached = pc_res.scalar_one_or_none()
            if cached:
                cached.price = str(round(item.current_price, 2))
                cached.last_updated = datetime.now(timezone.utc)
            else:
                db.add(PriceCache(
                    symbol=sym,
                    price=str(round(item.current_price, 2)),
                    day_change="0.00",
                    last_updated=datetime.now(timezone.utc)
                ))

        imported_count += 1

    await db.commit()
    return BulkImportResponse(
        success=True,
        imported_count=imported_count,
        message=f"Successfully synchronized {imported_count} holding(s)."
    )

@router.post("/sync/broker", response_model=BrokerSyncResponse)
async def sync_broker_holdings(
    req: BrokerSyncRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Directly synchronizes portfolio holdings from free broker APIs (Dhan, Upstox, Angel One)."""
    try:
        holdings = await BrokerSyncService.fetch_holdings(
            broker=req.broker,
            access_token=req.access_token,
            client_id=req.client_id,
            pin_or_totp=req.pin_or_totp
        )
        return BrokerSyncResponse(
            success=True,
            broker=req.broker,
            holdings=holdings,
            message=f"Found {len(holdings)} live holding(s) from {req.broker.title()}."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/prices/live")
async def get_live_prices(
    req: Optional[LivePricesRequest] = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Fetches real-time market prices & AMFI Mutual Fund NAVs for user holdings."""
    symbols = req.symbols if req and req.symbols else []
    if not symbols:
        # Get symbols from user's active investments
        res = await db.execute(
            select(Investment.symbol).where(and_(Investment.user_id == user_id, Investment.is_deleted == False))
        )
        symbols = [r[0] for r in res.all()]

    quotes = await MarketDataService.get_live_quotes(symbols, db)
    return {"quotes": quotes}

@router.post("/prices/refresh")
async def refresh_prices(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Refreshes market prices using live market data."""
    res = await db.execute(
        select(Investment.symbol).where(and_(Investment.user_id == user_id, Investment.is_deleted == False))
    )
    symbols = [r[0] for r in res.all()]
    quotes = await MarketDataService.get_live_quotes(symbols, db)
    return {"message": "Prices successfully refreshed from market data.", "quotes": quotes}

