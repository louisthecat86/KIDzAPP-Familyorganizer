interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface SpendingEntry {
  totalSats: number;
  resetTime: number;
}

const rateLimits: Map<string, RateLimitEntry> = new Map();
const spendingLimits: Map<number, SpendingEntry> = new Map();

const DEFAULT_PAYMENT_LIMIT = 10;
const DEFAULT_PAYMENT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const DEFAULT_DAILY_SPENDING_LIMIT = 100000;
const DEFAULT_PER_TX_LIMIT = 50000;
const DAILY_RESET_MS = 24 * 60 * 60 * 1000;

const userSpendingLimits: Map<number, { dailyLimit: number; perTxLimit: number }> = new Map();

export function setUserSpendingLimits(peerId: number, dailyLimit: number, perTxLimit: number): void {
  userSpendingLimits.set(peerId, { dailyLimit, perTxLimit });
  console.log(`[RateLimit] Set spending limits for peer ${peerId}: daily=${dailyLimit}, perTx=${perTxLimit}`);
}

export function getUserSpendingLimits(peerId: number): { dailyLimit: number; perTxLimit: number } {
  return userSpendingLimits.get(peerId) || { 
    dailyLimit: DEFAULT_DAILY_SPENDING_LIMIT, 
    perTxLimit: DEFAULT_PER_TX_LIMIT 
  };
}

export function checkPaymentRateLimit(peerId: number): { allowed: boolean; retryAfterMs?: number; remaining?: number } {
  const key = `payment:${peerId}`;
  const now = Date.now();
  
  const entry = rateLimits.get(key);
  
  if (!entry || now >= entry.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + DEFAULT_PAYMENT_WINDOW_MS });
    return { allowed: true, remaining: DEFAULT_PAYMENT_LIMIT - 1 };
  }
  
  if (entry.count >= DEFAULT_PAYMENT_LIMIT) {
    return { 
      allowed: false, 
      retryAfterMs: entry.resetTime - now,
      remaining: 0
    };
  }
  
  entry.count++;
  return { allowed: true, remaining: DEFAULT_PAYMENT_LIMIT - entry.count };
}

export function checkSpendingLimit(peerId: number, satsToSpend: number): { 
  allowed: boolean; 
  reason?: string;
  dailyRemaining?: number;
  dailySpent?: number;
} {
  const limits = getUserSpendingLimits(peerId);
  const now = Date.now();
  
  if (satsToSpend > limits.perTxLimit) {
    return { 
      allowed: false, 
      reason: `Transaction exceeds per-transaction limit of ${limits.perTxLimit} sats`,
      dailyRemaining: limits.dailyLimit
    };
  }
  
  const entry = spendingLimits.get(peerId);
  
  if (!entry || now >= entry.resetTime) {
    spendingLimits.set(peerId, { 
      totalSats: satsToSpend, 
      resetTime: now + DAILY_RESET_MS 
    });
    return { 
      allowed: true, 
      dailyRemaining: limits.dailyLimit - satsToSpend,
      dailySpent: satsToSpend
    };
  }
  
  if (entry.totalSats + satsToSpend > limits.dailyLimit) {
    return { 
      allowed: false, 
      reason: `Daily spending limit of ${limits.dailyLimit} sats exceeded`,
      dailyRemaining: limits.dailyLimit - entry.totalSats,
      dailySpent: entry.totalSats
    };
  }
  
  entry.totalSats += satsToSpend;
  return { 
    allowed: true, 
    dailyRemaining: limits.dailyLimit - entry.totalSats,
    dailySpent: entry.totalSats
  };
}

export function recordSpending(peerId: number, sats: number): void {
  const now = Date.now();
  const entry = spendingLimits.get(peerId);
  
  if (!entry || now >= entry.resetTime) {
    spendingLimits.set(peerId, { 
      totalSats: sats, 
      resetTime: now + DAILY_RESET_MS 
    });
  } else {
    entry.totalSats += sats;
  }
}

export function getDailySpending(peerId: number): number {
  const now = Date.now();
  const entry = spendingLimits.get(peerId);
  
  if (!entry || now >= entry.resetTime) {
    return 0;
  }
  
  return entry.totalSats;
}

export function getSpendingDetails(peerId: number): { spent: number; limit: number; remaining: number } {
  const limits = getUserSpendingLimits(peerId);
  const spent = getDailySpending(peerId);
  
  return { 
    spent, 
    limit: limits.dailyLimit, 
    remaining: Math.max(0, limits.dailyLimit - spent) 
  };
}
