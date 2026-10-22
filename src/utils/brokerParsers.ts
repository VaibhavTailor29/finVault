/**
 * Broker & Statement Parsers for FinVault.
 * Supports Zerodha, Groww, Upstox, Angel One, CAMS/KFintech CAS, and Generic CSV.
 * Uses PapaParse for CSV and SheetJS (xlsx) for Excel files.
 */
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { AssetType } from '../types';

export interface ParsedHoldingItem {
  id?: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  institution: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice?: number;
  categoryTag?: string;
  selected?: boolean;
}

export interface ParseResult {
  detectedSource: string;
  holdings: ParsedHoldingItem[];
  error?: string;
}

// Clean string helper
function cleanStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/^["']|["']$/g, '');
}

// Clean number helper
function cleanNum(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parses raw 2D array of rows into normalized ParsedHoldingItem list.
 */
export function parseRawRows(rows: (string | number)[][]): ParseResult {
  if (!rows || rows.length < 2) {
    return { detectedSource: 'Unknown', holdings: [], error: 'File is empty or contains insufficient rows.' };
  }

  // Find header row (the first row containing keywords like instrument, symbol, stock, name, qty, quantity)
  let headerIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const rowStr = rows[i].map((c) => cleanStr(c).toLowerCase()).join(' ');
    if (
      (rowStr.includes('symbol') || rowStr.includes('instrument') || rowStr.includes('stock') || rowStr.includes('company') || rowStr.includes('scheme')) &&
      (rowStr.includes('qty') || rowStr.includes('quantity') || rowStr.includes('units') || rowStr.includes('shares'))
    ) {
      headerIndex = i;
      headers = rows[i].map((c) => cleanStr(c).toLowerCase());
      break;
    }
  }

  if (headerIndex === -1) {
    // Fallback to first row
    headerIndex = 0;
    headers = rows[0].map((c) => cleanStr(c).toLowerCase());
  }

  const headerStr = headers.join(' ');
  let detectedSource = 'Generic CSV';
  let institution = 'Broker';

  if (headerStr.includes('instrument') && headerStr.includes('avg. cost')) {
    detectedSource = 'Zerodha Kite / Console';
    institution = 'Zerodha';
  } else if (headerStr.includes('stock name') && (headerStr.includes('average price') || headerStr.includes('avg price'))) {
    detectedSource = 'Groww';
    institution = 'Groww';
  } else if (headerStr.includes('scrip code') || (headerStr.includes('buy avg') && headerStr.includes('ltp'))) {
    detectedSource = 'Upstox';
    institution = 'Upstox';
  } else if (headerStr.includes('tradingsymbol') || headerStr.includes('symboltoken')) {
    detectedSource = 'Angel One';
    institution = 'Angel One';
  } else if (headerStr.includes('scheme') || headerStr.includes('folio') || headerStr.includes('amc')) {
    detectedSource = 'CAMS / KFintech CAS';
    institution = 'Mutual Fund';
  }

  const holdings: ParsedHoldingItem[] = [];

  // Helper to find column index by multiple keyword variations
  const findCol = (...keywords: string[]): number => {
    return headers.findIndex((h) => keywords.some((k) => h.includes(k)));
  };

  const symIdx = findCol('symbol', 'instrument', 'scrip code', 'tradingsymbol', 'ticker');
  const nameIdx = findCol('name', 'stock name', 'company', 'security name', 'scheme name');
  const qtyIdx = findCol('qty.', 'qty', 'quantity', 'units', 'shares', 'totalqty');
  const priceIdx = findCol('avg. cost', 'avg cost', 'avg. price', 'average price', 'buy avg', 'buy price', 'cost price', 'price');
  const ltpIdx = findCol('ltp', 'last price', 'cur. val', 'current price', 'cmp');

  const dataRows = rows.slice(headerIndex + 1);

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    if (!row || row.length === 0) continue;

    let sym = symIdx !== -1 ? cleanStr(row[symIdx]) : '';
    let name = nameIdx !== -1 ? cleanStr(row[nameIdx]) : '';
    const qty = qtyIdx !== -1 ? cleanNum(row[qtyIdx]) : 0;
    const avgPrice = priceIdx !== -1 ? cleanNum(row[priceIdx]) : 0;
    const ltp = ltpIdx !== -1 ? cleanNum(row[ltpIdx]) : undefined;

    if (!sym && name) {
      sym = name.split(' ')[0].toUpperCase();
    }
    if (!name && sym) {
      name = sym;
    }

    // Skip empty, header repetitions or disclaimer rows
    if (!sym || qty <= 0 || sym.toLowerCase() === 'total' || sym.toLowerCase().includes('disclaimer')) {
      continue;
    }

    // Determine asset type
    let assetType: AssetType = 'Stock';
    let categoryTag = 'Equity';

    const lowerName = (name + ' ' + sym).toLowerCase();
    if (lowerName.includes('gold') || lowerName.includes('sgb') || lowerName.includes('goldbees')) {
      assetType = lowerName.includes('sgb') ? 'Sovereign Gold Bond' : 'Gold';
      categoryTag = 'Gold / SGB';
    } else if (lowerName.includes('fund') || lowerName.includes('growth') || lowerName.includes('direct') || lowerName.includes('etf')) {
      assetType = lowerName.includes('etf') ? 'ETF' : 'Mutual Fund';
      categoryTag = 'Mutual Funds';
    } else if (lowerName.includes('reit') || lowerName.includes('invit')) {
      assetType = lowerName.includes('invit') ? 'InvIT' : 'REIT';
      categoryTag = 'Real Estate';
    } else if (lowerName.includes('bond') || lowerName.includes('g-sec') || lowerName.includes('ncd')) {
      assetType = lowerName.includes('ncd') || lowerName.includes('corporate') ? 'Corporate Bond' : 'Government Bond';
      categoryTag = 'Bonds';
    }

    holdings.push({
      id: `hold_${Date.now()}_${r}`,
      symbol: sym.toUpperCase(),
      name,
      assetType,
      institution,
      quantity: qty,
      avgBuyPrice: avgPrice,
      currentPrice: ltp && ltp > 0 ? ltp : avgPrice,
      categoryTag,
      selected: true,
    });
  }

  return {
    detectedSource,
    holdings,
  };
}

/**
 * Parses a CSV string or text pasted by user.
 */
export function parseCsvText(csvText: string): ParseResult {
  try {
    const parsed = Papa.parse<string[]>(csvText.trim(), {
      skipEmptyLines: true,
    });
    if (parsed.errors && parsed.errors.length > 0 && parsed.data.length === 0) {
      return { detectedSource: 'Unknown', holdings: [], error: parsed.errors[0].message };
    }
    return parseRawRows(parsed.data as any[][]);
  } catch (err: any) {
    return { detectedSource: 'Unknown', holdings: [], error: err.message || 'Failed to parse CSV text.' };
  }
}

/**
 * Parses an uploaded File (CSV or Excel).
 */
export async function parseHoldingFile(file: File): Promise<ParseResult> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
    return new Promise((resolve) => {
      Papa.parse(file, {
        complete: (results) => {
          resolve(parseRawRows(results.data as any[][]));
        },
        error: (err) => {
          resolve({ detectedSource: 'Unknown', holdings: [], error: err.message });
        },
      });
    });
  }

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number)[][];
          resolve(parseRawRows(rows));
        } catch (err: any) {
          resolve({ detectedSource: 'Unknown', holdings: [], error: err.message || 'Failed to read Excel file.' });
        }
      };
      reader.onerror = () => {
        resolve({ detectedSource: 'Unknown', holdings: [], error: 'Failed to read file.' });
      };
      reader.readAsArrayBuffer(file);
    });
  }

  return { detectedSource: 'Unknown', holdings: [], error: 'Unsupported file type. Please upload a .csv, .xlsx, or .xls file.' };
}

/**
 * Generates a standard FinVault holdings CSV template for users to download.
 */
export function generateSampleHoldingsCsv(): string {
  const headers = ['Symbol', 'Name', 'Asset Type', 'Institution', 'Quantity', 'Avg Buy Price', 'Current Price', 'Category'];
  const sampleRows = [
    ['RELIANCE', 'Reliance Industries Ltd', 'Stocks', 'Zerodha', '25', '2450.00', '2580.50', 'Large Cap'],
    ['TCS', 'Tata Consultancy Services', 'Stocks', 'Zerodha', '15', '3600.00', '3920.00', 'IT Sector'],
    ['122639', 'Parag Parikh Flexi Cap Fund Direct-Growth', 'Mutual Fund', 'Groww', '150.45', '65.20', '78.50', 'Flexi Cap'],
    ['GOLDBEES', 'Nippon India ETF Gold BeES', 'Gold', 'Upstox', '50', '58.40', '64.10', 'Gold'],
    ['EMBASSY', 'Embassy Office Parks REIT', 'REIT', 'Zerodha', '100', '340.00', '385.00', 'Commercial REIT'],
  ];

  return [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
}
