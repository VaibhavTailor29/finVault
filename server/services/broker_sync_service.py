"""
BrokerSyncService: Free Broker API Integration.
Supports fetching live portfolio holdings directly from free broker APIs:
- Dhan (DhanHQ free API)
- Upstox (v2 portfolio API)
- Angel One (SmartAPI free portfolio endpoint)
"""
from typing import List, Dict, Any, Optional
import httpx
from server.schemas.schemas import HoldingImportItem

class BrokerSyncService:
    @staticmethod
    async def fetch_holdings(
        broker: str,
        access_token: str,
        client_id: Optional[str] = None,
        pin_or_totp: Optional[str] = None
    ) -> List[HoldingImportItem]:
        broker = broker.lower().strip()
        holdings: List[HoldingImportItem] = []

        async with httpx.AsyncClient(timeout=10.0) as client:
            if broker == "dhan":
                # DhanHQ API v2
                headers = {
                    "access-token": access_token.strip(),
                    "client-id": (client_id or "").strip(),
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
                res = await client.get("https://api.dhan.co/v2/holdings", headers=headers)
                if res.status_code != 200:
                    detail = res.text[:200]
                    raise ValueError(f"Dhan API error ({res.status_code}): {detail}")
                
                data = res.json()
                items = data if isinstance(data, list) else data.get("data", [])
                for item in items:
                    sym = item.get("tradingSymbol") or item.get("securityId") or "UNKNOWN"
                    qty = float(item.get("totalQty") or item.get("holdingQty") or 0)
                    if qty <= 0:
                        continue
                    avg_p = float(item.get("avgCostPrice") or item.get("costPrice") or 0)
                    ltp = float(item.get("lastTradedPrice") or item.get("close") or avg_p)
                    name = item.get("securityName") or sym
                    holdings.append(HoldingImportItem(
                        symbol=sym,
                        name=name,
                        asset_type="Stocks",
                        institution="Dhan",
                        quantity=qty,
                        avg_buy_price=avg_p,
                        current_price=ltp,
                        category_tag="Equity"
                    ))

            elif broker == "upstox":
                # Upstox API v2
                headers = {
                    "Authorization": f"Bearer {access_token.strip()}",
                    "Accept": "application/json"
                }
                res = await client.get("https://api.upstox.com/v2/portfolio/long-term-holdings", headers=headers)
                if res.status_code != 200:
                    detail = res.text[:200]
                    raise ValueError(f"Upstox API error ({res.status_code}): {detail}")
                
                data = res.json()
                items = data.get("data", [])
                for item in items:
                    sym = item.get("trading_symbol") or item.get("isin") or "UNKNOWN"
                    qty = float(item.get("quantity") or 0)
                    if qty <= 0:
                        continue
                    avg_p = float(item.get("average_price") or 0)
                    ltp = float(item.get("last_price") or avg_p)
                    name = item.get("company_name") or sym
                    holdings.append(HoldingImportItem(
                        symbol=sym,
                        name=name,
                        asset_type="Stocks",
                        institution="Upstox",
                        quantity=qty,
                        avg_buy_price=avg_p,
                        current_price=ltp,
                        category_tag="Equity"
                    ))

            elif broker == "angelone":
                # Angel One SmartAPI
                headers = {
                    "Authorization": f"Bearer {access_token.strip()}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
                if client_id:
                    headers["X-PrivateKey"] = client_id.strip()
                res = await client.get(
                    "https://apiconnect.angelone.in/rest/secure/angelbroking/portfolio/v1/getAllHolding",
                    headers=headers
                )
                if res.status_code != 200:
                    detail = res.text[:200]
                    raise ValueError(f"Angel One API error ({res.status_code}): {detail}")

                data = res.json()
                items = data.get("data", {}).get("holdings", []) if isinstance(data.get("data"), dict) else data.get("data", [])
                for item in items:
                    sym = item.get("tradingsymbol") or item.get("symbolname") or "UNKNOWN"
                    qty = float(item.get("totalqty") or item.get("quantity") or 0)
                    if qty <= 0:
                        continue
                    avg_p = float(item.get("avgprice") or item.get("price") or 0)
                    ltp = float(item.get("ltp") or avg_p)
                    name = item.get("symbolname") or sym
                    holdings.append(HoldingImportItem(
                        symbol=sym,
                        name=name,
                        asset_type="Stocks",
                        institution="Angel One",
                        quantity=qty,
                        avg_buy_price=avg_p,
                        current_price=ltp,
                        category_tag="Equity"
                    ))
            elif broker == "groww":
                # Official Groww Trading API integration via growwapi
                token = access_token.strip()

                if client_id and client_id.strip():
                    try:
                        from growwapi import GrowwAPI
                        generated_token = GrowwAPI.get_access_token(
                            api_key=client_id.strip(),
                            secret=token
                        )
                        if generated_token:
                            token = generated_token
                    except Exception as e:
                        err_msg = str(e)
                        if "Groww API Error" in err_msg or "Failed" in err_msg:
                            raise ValueError(f"Groww Token Error: {err_msg}")

                from growwapi import GrowwAPI
                groww_client = GrowwAPI(token)

                # 1. Fetch Demat delivery holdings
                raw_holdings = {}
                try:
                    raw_holdings = groww_client.get_holdings_for_user()
                    print(f"[Groww DEBUG] raw_holdings response: {raw_holdings}")
                except Exception as e:
                    print(f"[Groww DEBUG] get_holdings_for_user error: {e}")

                # 2. Fetch active positions as well (in case assets are in positions)
                raw_positions = {}
                try:
                    raw_positions = groww_client.get_positions_for_user()
                    print(f"[Groww DEBUG] raw_positions response: {raw_positions}")
                except Exception as e:
                    print(f"[Groww DEBUG] get_positions_for_user error: {e}")

                # Parse holdings items from all possible response keys
                holding_items = []
                if isinstance(raw_holdings, dict):
                    holding_items = raw_holdings.get("holdings") or raw_holdings.get("user_holdings") or raw_holdings.get("data") or []
                elif isinstance(raw_holdings, list):
                    holding_items = raw_holdings

                # Parse positions items if holdings empty
                position_items = []
                if isinstance(raw_positions, dict):
                    position_items = raw_positions.get("positions") or raw_positions.get("user_positions") or raw_positions.get("data") or []
                elif isinstance(raw_positions, list):
                    position_items = raw_positions

                combined_items = list(holding_items)
                # Add positions not already in holdings
                existing_symbols = {item.get("trading_symbol") or item.get("symbol") for item in combined_items if isinstance(item, dict)}
                for pos in position_items:
                    if isinstance(pos, dict):
                        sym = pos.get("trading_symbol") or pos.get("symbol")
                        if sym and sym not in existing_symbols:
                            combined_items.append(pos)

                if not combined_items and isinstance(raw_holdings, dict) and not holding_items:
                    # Provide informative message if API returned zero items
                    keys_found = list(raw_holdings.keys())
                    print(f"[Groww DEBUG] Keys in response: {keys_found}")

                # 3. Fetch live market prices (LTP) directly from Groww API
                # Groww's /holdings/user only returns buy price and quantity, not live LTP.
                # Groww provides get_ltp(exchange_trading_symbols, segment="CASH")
                ltp_map: Dict[str, float] = {}
                symbols_to_fetch = []
                for item in combined_items:
                    if isinstance(item, dict):
                        sym = item.get("trading_symbol") or item.get("symbol")
                        exchanges = item.get("tradable_exchanges") or ["NSE", "BSE"]
                        preferred_exchange = "NSE" if "NSE" in exchanges else exchanges[0]
                        if sym:
                            symbols_to_fetch.append(f"{preferred_exchange}_{sym}")

                if symbols_to_fetch:
                    try:
                        ltp_res = groww_client.get_ltp(
                            exchange_trading_symbols=tuple(symbols_to_fetch),
                            segment=GrowwAPI.SEGMENT_CASH
                        )
                        print(f"[Groww DEBUG] get_ltp response: {ltp_res}")
                        # ltp_res format is typically {"NSE_SUZLON": 68.5, ...} or {"payload": {...}}
                        data_dict = ltp_res if isinstance(ltp_res, dict) else {}
                        for k, v in data_dict.items():
                            clean_sym = k.split("_", 1)[-1] if "_" in k else k
                            price_val = float(v.get("ltp") or v.get("last_price") or v) if isinstance(v, (dict, int, float, str)) else 0.0
                            if price_val > 0:
                                ltp_map[clean_sym] = price_val
                    except Exception as e:
                        print(f"[Groww DEBUG] get_ltp error: {e}")

                for item in combined_items:
                    if not isinstance(item, dict):
                        continue
                    sym = (item.get("trading_symbol") or item.get("groww_symbol") or item.get("isin") or item.get("symbol") or "UNKNOWN").upper()
                    qty = float(item.get("quantity") or item.get("net_quantity") or item.get("total_quantity") or 0)
                    if qty <= 0:
                        continue
                    avg_p = float(item.get("average_price") or item.get("buy_price") or item.get("avg_price") or 0)
                    # Use live market LTP from Groww get_ltp, fallback to item or avg_p
                    ltp = ltp_map.get(sym) or float(item.get("ltp") or item.get("last_price") or item.get("close_price") or avg_p)
                    name = item.get("company_name") or item.get("name") or sym

                    # Smart Asset-Type & Category Detection:
                    # In Indian exchanges, symbols with numbers & company initials (e.g. 880CGCL29 = 8.80% Capri Global Capital Ltd 2029 NCD)
                    # or GS/GSEC/TBILL/NCD are Bonds. SGB is Sovereign Gold Bond.
                    lower_sym = sym.lower()
                    lower_name = name.lower()
                    combined_check = f"{lower_sym} {lower_name}"

                    asset_type = "Stock"
                    category_tag = "Equity"

                    if "sgb" in combined_check or "goldbees" in combined_check or "gold" in combined_check:
                        asset_type = "Sovereign Gold Bond" if "sgb" in combined_check else "Gold"
                        category_tag = "Gold / SGB"
                    elif any(k in combined_check for k in ["bond", "ncd", "gsec", "g-sec", "tbill", "debenture"]) or (
                        # Matches patterns like 880CGCL29 (interest rate + company code + maturity year)
                        any(c.isdigit() for c in sym) and any(b_ind in sym for b_ind in ["GS", "NCD", "CL", "BOND", "F"])
                    ):
                        asset_type = "Corporate Bond" if any(c in combined_check for c in ["ncd", "cl", "corp", "capri"]) else "Government Bond"
                        category_tag = "Bonds"
                    elif "reit" in combined_check or "invit" in combined_check:
                        asset_type = "InvIT" if "invit" in combined_check else "REIT"
                        category_tag = "Real Estate"
                    elif "etf" in combined_check or "bees" in combined_check:
                        asset_type = "ETF"
                        category_tag = "Equity"

                    holdings.append(HoldingImportItem(
                        symbol=sym,
                        name=name,
                        asset_type=asset_type,
                        institution="Groww",
                        quantity=qty,
                        avg_buy_price=avg_p,
                        current_price=ltp,
                        category_tag=category_tag
                    ))

            else:
                raise ValueError(f"Unsupported broker '{broker}'. Supported free brokers: groww, dhan, upstox, angelone")

        return holdings
