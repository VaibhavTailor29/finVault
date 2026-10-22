"""
MarketDataService: Free live quote and NAV service.
Fetches real-time mutual fund NAVs from AMFI/MFAPI (100% free)
and handles market price lookups with robust caching.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from server.models.models import PriceCache

class MarketDataService:
    @staticmethod
    async def get_live_quotes(symbols: List[str], db: Optional[AsyncSession] = None) -> Dict[str, Dict[str, Any]]:
        """
        Fetches live market prices/NAVs for given symbols.
        Checks MFAPI for mutual funds, and uses cached prices with graceful fallbacks.
        """
        quotes: Dict[str, Dict[str, Any]] = {}
        now_iso = datetime.now(timezone.utc).isoformat()

        async with httpx.AsyncClient(timeout=4.0) as client:
            for raw_sym in symbols:
                sym = raw_sym.strip().upper()
                if not sym:
                    continue

                # 1. Check if it's a numeric Mutual Fund scheme code
                if sym.isdigit():
                    try:
                        res = await client.get(f"https://api.mfapi.in/mf/{sym}")
                        if res.status_code == 200:
                            data = res.json()
                            history = data.get("data", [])
                            if history:
                                latest = history[0]
                                prev = history[1] if len(history) > 1 else latest
                                nav = float(latest.get("nav", 0))
                                prev_nav = float(prev.get("nav", nav))
                                day_change = round(((nav - prev_nav) / prev_nav) * 100, 2) if prev_nav > 0 else 0.0
                                quotes[sym] = {
                                    "symbol": sym,
                                    "name": data.get("meta", {}).get("scheme_name", sym),
                                    "price": nav,
                                    "day_change_pct": day_change,
                                    "last_updated": now_iso,
                                    "source": "AMFI / MFAPI"
                                }
                                continue
                    except Exception:
                        pass

                # 2. Check PriceCache from DB if provided
                if db:
                    try:
                        res = await db.execute(select(PriceCache).where(PriceCache.symbol == sym))
                        cache_entry = res.scalar_one_or_none()
                        if cache_entry:
                            quotes[sym] = {
                                "symbol": sym,
                                "price": float(cache_entry.price),
                                "day_change_pct": float(cache_entry.day_change),
                                "last_updated": cache_entry.last_updated.isoformat() if cache_entry.last_updated else now_iso,
                                "source": "Cache"
                            }
                    except Exception:
                        pass

        return quotes
