/**
 * LNURL-pay utility for fetching invoices from Lightning Addresses
 * 
 * This module implements the LNURL-pay protocol to automatically
 * generate invoices from Lightning Addresses (e.g., name@wallet.com)
 */

interface LnurlPayResponse {
  callback: string;
  maxSendable: number; // millisatoshis
  minSendable: number; // millisatoshis
  metadata: string;
  tag: string;
  commentAllowed?: number;
}

interface InvoiceResponse {
  pr: string; // bolt11 payment request
  routes?: any[];
  successAction?: any;
}

interface GeneratedInvoice {
  bolt11: string;
  paymentHash: string;
  expiresAt: Date;
  amountSats: number;
  memo: string;
}

export class LnurlPayError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'LnurlPayError';
  }
}

function parseLightningAddress(address: string): { username: string; domain: string } {
  const parts = address.split('@');
  if (parts.length !== 2) {
    throw new LnurlPayError('Invalid Lightning Address format', 'INVALID_FORMAT');
  }
  return { username: parts[0], domain: parts[1] };
}

function extractPaymentHash(bolt11: string): string {
  try {
    const paymentHashMatch = bolt11.match(/lnbc[a-z0-9]+1p([a-z0-9]+)/i);
    if (paymentHashMatch) {
      return paymentHashMatch[0].substring(0, 64);
    }
    return bolt11.substring(0, 64);
  } catch {
    return bolt11.substring(0, 64);
  }
}

export async function fetchInvoiceFromLightningAddress(
  lightningAddress: string,
  amountSats: number,
  memo?: string
): Promise<GeneratedInvoice> {
  const { username, domain } = parseLightningAddress(lightningAddress);
  
  // Construct LNURL-pay endpoint URL (HTTPS only for security)
  const lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;
  
  console.log(`[LNURL] Fetching from: ${lnurlEndpoint}`);
  
  // Step 1: Fetch LNURL-pay metadata
  let lnurlResponse: LnurlPayResponse;
  try {
    const response = await fetch(lnurlEndpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!response.ok) {
      throw new LnurlPayError(
        `Lightning Address provider returned ${response.status}`,
        'PROVIDER_ERROR'
      );
    }
    
    lnurlResponse = await response.json();
  } catch (error: any) {
    if (error instanceof LnurlPayError) throw error;
    if (error.name === 'TimeoutError') {
      throw new LnurlPayError('Lightning Address provider timed out', 'TIMEOUT');
    }
    throw new LnurlPayError(
      `Failed to reach Lightning Address provider: ${error.message}`,
      'NETWORK_ERROR'
    );
  }
  
  // Validate response
  if (lnurlResponse.tag !== 'payRequest') {
    throw new LnurlPayError('Invalid LNURL-pay response', 'INVALID_RESPONSE');
  }
  
  // Convert sats to millisats
  const amountMsats = amountSats * 1000;
  
  // Check amount bounds
  if (amountMsats < lnurlResponse.minSendable) {
    throw new LnurlPayError(
      `Amount too small. Minimum: ${Math.ceil(lnurlResponse.minSendable / 1000)} sats`,
      'AMOUNT_TOO_SMALL'
    );
  }
  
  if (amountMsats > lnurlResponse.maxSendable) {
    throw new LnurlPayError(
      `Amount too large. Maximum: ${Math.floor(lnurlResponse.maxSendable / 1000)} sats`,
      'AMOUNT_TOO_LARGE'
    );
  }
  
  // Step 2: Request invoice from callback URL
  const callbackUrl = new URL(lnurlResponse.callback);
  callbackUrl.searchParams.set('amount', amountMsats.toString());
  
  // Add comment if allowed and provided
  if (memo && lnurlResponse.commentAllowed && memo.length <= lnurlResponse.commentAllowed) {
    callbackUrl.searchParams.set('comment', memo);
  }
  
  console.log(`[LNURL] Requesting invoice from: ${callbackUrl.toString()}`);
  
  let invoiceResponse: InvoiceResponse;
  try {
    const response = await fetch(callbackUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new LnurlPayError(
        `Failed to get invoice: ${errorText}`,
        'INVOICE_ERROR'
      );
    }
    
    invoiceResponse = await response.json();
  } catch (error: any) {
    if (error instanceof LnurlPayError) throw error;
    if (error.name === 'TimeoutError') {
      throw new LnurlPayError('Invoice request timed out', 'TIMEOUT');
    }
    throw new LnurlPayError(
      `Failed to get invoice: ${error.message}`,
      'NETWORK_ERROR'
    );
  }
  
  if (!invoiceResponse.pr) {
    throw new LnurlPayError('No invoice returned', 'NO_INVOICE');
  }
  
  // Extract payment hash from bolt11
  const paymentHash = extractPaymentHash(invoiceResponse.pr);
  
  // Invoices typically expire in 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  
  console.log(`[LNURL] Invoice generated successfully for ${amountSats} sats`);
  
  return {
    bolt11: invoiceResponse.pr,
    paymentHash,
    expiresAt,
    amountSats,
    memo: memo || `Payment of ${amountSats} sats`,
  };
}

export function isValidLightningAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(address);
}
