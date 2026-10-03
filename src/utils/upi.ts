/**
 * UPI Deep Link & Payment String Generator (Phase 4).
 * Generates standards-compliant upi://pay URI strings.
 */

export interface UpiPaymentParams {
  pa: string; // VPA / UPI ID (e.g. vaibhav@upi)
  pn: string; // Payee Name
  am: number; // Amount
  cu?: string; // Currency (INR)
  tn?: string; // Transaction Note
}

export function generateUpiUri(params: UpiPaymentParams): string {
  const cu = params.cu || 'INR';
  const tn = encodeURIComponent(params.tn || 'Settlement via FinVault');
  const pn = encodeURIComponent(params.pn);
  return `upi://pay?pa=${params.pa}&pn=${pn}&am=${params.am.toFixed(2)}&cu=${cu}&tn=${tn}`;
}
