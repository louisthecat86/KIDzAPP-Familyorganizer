import { db } from "./db";
import { sql } from "drizzle-orm";

export type AuditAction = 
  | 'wallet_connect_lnbits'
  | 'wallet_connect_nwc'
  | 'wallet_disconnect'
  | 'payment_sent'
  | 'payment_received'
  | 'payment_failed'
  | 'task_approved'
  | 'allowance_paid'
  | 'spending_limit_changed'
  | 'login_success'
  | 'login_failed'
  | 'pin_changed';

export interface AuditEntry {
  peerId: number;
  action: AuditAction;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const auditLog: AuditEntry[] = [];
const MAX_LOG_SIZE = 10000;

export async function logAudit(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  const fullEntry: AuditEntry = {
    ...entry,
    timestamp: new Date(),
    details: {
      ...entry.details,
      sensitiveDataRedacted: true
    }
  };
  
  auditLog.push(fullEntry);
  
  if (auditLog.length > MAX_LOG_SIZE) {
    auditLog.shift();
  }
  
  const logLevel = entry.action.includes('failed') ? 'WARN' : 'INFO';
  console.log(`[AUDIT][${logLevel}] ${entry.action} - Peer: ${entry.peerId} - ${JSON.stringify(entry.details)}`);
  
  try {
    await db.execute(sql`
      INSERT INTO audit_logs (peer_id, action, details, ip_address, user_agent, created_at)
      VALUES (${entry.peerId}, ${entry.action}, ${JSON.stringify(entry.details)}::jsonb, ${entry.ipAddress || null}, ${entry.userAgent || null}, NOW())
    `);
  } catch (error) {
    console.log('[AUDIT] Database logging skipped (table may not exist yet)');
  }
}

export function getRecentAuditLogs(peerId?: number, limit: number = 100): AuditEntry[] {
  let logs = [...auditLog].reverse();
  
  if (peerId !== undefined) {
    logs = logs.filter(l => l.peerId === peerId);
  }
  
  return logs.slice(0, limit);
}

export function getPaymentAuditLogs(peerId: number, since: Date): AuditEntry[] {
  return auditLog.filter(l => 
    l.peerId === peerId && 
    l.timestamp >= since &&
    (l.action === 'payment_sent' || l.action === 'payment_received' || l.action === 'payment_failed')
  );
}
