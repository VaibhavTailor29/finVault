/**
 * Live Zero-Auth Yahoo Finance WebSocket Streamer
 * Connects directly to wss://streamer.finance.yahoo.com from the browser.
 * Zero API keys, zero authentication, real-time sub-second price ticks.
 */
import protobuf from 'protobufjs';

// Pre-compiled proto definition for Yahoo Finance PricingData
const YAHOO_PROTO = {
  nested: {
    quotefeeder: {
      nested: {
        PricingData: {
          fields: {
            id: { type: 'string', id: 1 },
            price: { type: 'float', id: 2 },
            time: { type: 'sint64', id: 3 },
            currency: { type: 'string', id: 4 },
            exchange: { type: 'string', id: 5 },
            quoteType: { type: 'int32', id: 6 },
            marketHours: { type: 'int32', id: 7 },
            changePercent: { type: 'float', id: 8 },
            dayVolume: { type: 'sint64', id: 9 },
            dayHigh: { type: 'float', id: 10 },
            dayLow: { type: 'float', id: 11 },
            change: { type: 'float', id: 12 },
            shortName: { type: 'string', id: 13 },
            expireDate: { type: 'sint64', id: 14 },
            openPrice: { type: 'float', id: 15 },
            previousClose: { type: 'float', id: 16 }
          }
        }
      }
    }
  }
};

export interface LivePriceTick {
  symbol: string;
  price: number;
  changePercent: number;
  change: number;
  dayHigh?: number;
  dayLow?: number;
  timestamp: number;
}

export type TickCallback = (tick: LivePriceTick) => void;

class YahooLiveStreamer {
  private socket: WebSocket | null = null;
  private root: protobuf.Root | null = null;
  private PricingDataType: protobuf.Type | null = null;
  private activeSubscriptions = new Set<string>();
  private listeners = new Set<TickCallback>();
  private isConnecting = false;
  private reconnectTimer: any = null;

  constructor() {
    try {
      this.root = protobuf.Root.fromJSON(YAHOO_PROTO as any);
      this.PricingDataType = this.root.lookupType('quotefeeder.PricingData');
    } catch (err) {
      console.error('[YahooLiveStreamer] Failed to initialize protobuf:', err);
    }
  }

  /**
   * Maps Indian NSE/BSE symbols to Yahoo Finance format.
   * e.g., SUZLON -> SUZLON.NS, SBIN -> SBIN.NS
   */
  public toYahooSymbol(symbol: string): string {
    const s = symbol.trim().toUpperCase();
    if (!s) return '';
    // If it already has an exchange suffix or contains a dash or hat, return as is
    if (s.includes('.') || s.includes('-') || s.startsWith('^')) return s;
    // By default, Indian stocks in NSE are suffixed with .NS
    return `${s}.NS`;
  }

  /**
   * Strips .NS / .BO from Yahoo symbol back to base symbol.
   */
  public fromYahooSymbol(yahooSymbol: string): string {
    return yahooSymbol.replace(/\.(NS|BO|ns|bo)$/i, '').trim().toUpperCase();
  }

  public subscribe(symbols: string[], callback: TickCallback): () => void {
    const yahooSymbols = symbols
      .map((s) => this.toYahooSymbol(s))
      .filter((s) => Boolean(s));

    yahooSymbols.forEach((s) => this.activeSubscriptions.add(s));
    this.listeners.add(callback);

    this.ensureConnection();

    // If socket is already open, send immediate subscription message
    if (this.socket && this.socket.readyState === WebSocket.OPEN && yahooSymbols.length > 0) {
      try {
        this.socket.send(JSON.stringify({ subscribe: yahooSymbols }));
      } catch (e) {
        console.warn('[YahooLiveStreamer] Failed to send subscription:', e);
      }
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  private ensureConnection() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.isConnecting) return;

    this.isConnecting = true;
    try {
      this.socket = new WebSocket('wss://streamer.finance.yahoo.com/?version=2');

      this.socket.onopen = () => {
        this.isConnecting = false;
        if (this.activeSubscriptions.size > 0 && this.socket?.readyState === WebSocket.OPEN) {
          const subs = Array.from(this.activeSubscriptions);
          this.socket.send(JSON.stringify({ subscribe: subs }));
        }
      };

      this.socket.onmessage = async (event: MessageEvent) => {
        if (!this.PricingDataType) return;
        try {
          let base64Payload: string | null = null;
          let buffer: Uint8Array | null = null;

          if (typeof event.data === 'string') {
            const raw = event.data.trim();
            if (raw.startsWith('{')) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed.message) {
                  base64Payload = parsed.message;
                }
              } catch (e) {
                // not JSON format
              }
            } else {
              base64Payload = raw;
            }

            if (base64Payload) {
              const binaryStr = atob(base64Payload);
              buffer = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                buffer[i] = binaryStr.charCodeAt(i);
              }
            }
          } else if (event.data instanceof ArrayBuffer) {
            buffer = new Uint8Array(event.data);
          } else if (typeof Blob !== 'undefined' && event.data instanceof Blob) {
            const arr = await event.data.arrayBuffer();
            buffer = new Uint8Array(arr);
          }

          if (!buffer || buffer.length === 0) return;

          const decoded: any = this.PricingDataType.decode(buffer);
          if (decoded && decoded.id && typeof decoded.price === 'number') {
            const cleanSym = this.fromYahooSymbol(decoded.id);
            const tick: LivePriceTick = {
              symbol: cleanSym,
              price: Number(decoded.price.toFixed(2)),
              changePercent: Number((decoded.changePercent || 0).toFixed(2)),
              change: Number((decoded.change || 0).toFixed(2)),
              dayHigh: decoded.dayHigh ? Number(decoded.dayHigh.toFixed(2)) : undefined,
              dayLow: decoded.dayLow ? Number(decoded.dayLow.toFixed(2)) : undefined,
              timestamp: Date.now()
            };

            // Notify all active listeners
            this.listeners.forEach((listener) => {
              try {
                listener(tick);
              } catch (e) {
                console.error('[YahooLiveStreamer] Listener error:', e);
              }
            });
          }
        } catch (err) {
          // Ignore decoding hiccups on fragmented / control frames
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[YahooLiveStreamer] WebSocket event:', err);
      };

      this.socket.onclose = () => {
        this.isConnecting = false;
        this.socket = null;
        // Auto-reconnect if we still have active subscriptions
        if (this.listeners.size > 0 && this.activeSubscriptions.size > 0) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this.ensureConnection(), 4000);
        }
      };
    } catch (err) {
      this.isConnecting = false;
      console.error('[YahooLiveStreamer] Failed to connect:', err);
    }
  }

  public disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {}
      this.socket = null;
    }
    this.activeSubscriptions.clear();
    this.listeners.clear();
    this.isConnecting = false;
  }
}

export const yahooLiveStreamer = new YahooLiveStreamer();
