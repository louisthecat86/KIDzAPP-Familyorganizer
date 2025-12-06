import webpush from 'web-push';
import { db } from './db';
import { pushSubscriptions, peers } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = 'mailto:support@kidzapp.de';

let pushEnabled = false;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  pushEnabled = true;
  console.log('[Push] VAPID keys configured - push notifications enabled');
} else {
  console.warn('[Push] VAPID_PUBLIC_KEY and/or VAPID_PRIVATE_KEY not set - push notifications disabled');
  console.warn('[Push] Generate new keys with: npx web-push generate-vapid-keys');
}

export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC_KEY || null;
}

export function isPushEnabled(): boolean {
  return pushEnabled;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{ action: string; title: string }>;
}

export async function sendPushToUser(peerId: number, payload: PushPayload): Promise<{ success: number; failed: number }> {
  if (!pushEnabled) {
    return { success: 0, failed: 0 };
  }
  
  const subscriptions = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.peerId, peerId));
  
  let success = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icon-192.png',
          badge: payload.badge || '/favicon.png',
          tag: payload.tag || 'kidzapp-notification',
          data: payload.data || {},
          actions: payload.actions || []
        })
      );
      success++;
    } catch (error: any) {
      console.error(`[Push] Failed to send to subscription ${sub.id}:`, error.message);
      if (error.statusCode === 410 || error.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        console.log(`[Push] Removed expired subscription ${sub.id}`);
      }
      failed++;
    }
  }

  return { success, failed };
}

export async function sendPushToFamily(connectionId: string, payload: PushPayload, excludePeerId?: number): Promise<{ success: number; failed: number }> {
  if (!pushEnabled) {
    return { success: 0, failed: 0 };
  }
  
  let query = db.select().from(pushSubscriptions).where(eq(pushSubscriptions.connectionId, connectionId));
  const subscriptions = await query;
  
  let success = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    if (excludePeerId && sub.peerId === excludePeerId) continue;
    
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icon-192.png',
          badge: payload.badge || '/favicon.png',
          tag: payload.tag || 'kidzapp-notification',
          data: payload.data || {},
          actions: payload.actions || []
        })
      );
      success++;
    } catch (error: any) {
      console.error(`[Push] Failed to send to subscription ${sub.id}:`, error.message);
      if (error.statusCode === 410 || error.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        console.log(`[Push] Removed expired subscription ${sub.id}`);
      }
      failed++;
    }
  }

  return { success, failed };
}

export async function sendPushToParents(connectionId: string, payload: PushPayload): Promise<{ success: number; failed: number }> {
  const parents = await db.select().from(peers).where(
    and(eq(peers.connectionId, connectionId), eq(peers.role, 'parent'))
  );
  
  let totalSuccess = 0;
  let totalFailed = 0;

  for (const parent of parents) {
    const result = await sendPushToUser(parent.id, payload);
    totalSuccess += result.success;
    totalFailed += result.failed;
  }

  return { success: totalSuccess, failed: totalFailed };
}

export async function notifyTaskCreated(connectionId: string, taskTitle: string, sats: number, creatorId: number): Promise<void> {
  await sendPushToFamily(connectionId, {
    title: 'Neue Aufgabe!',
    body: `${taskTitle} - ${sats} Sats Belohnung`,
    tag: 'task-created',
    data: { type: 'task-created', url: '/' }
  }, creatorId);
}

export async function notifyTaskSubmitted(connectionId: string, childName: string, taskTitle: string): Promise<void> {
  await sendPushToParents(connectionId, {
    title: 'Aufgabe eingereicht!',
    body: `${childName} hat "${taskTitle}" erledigt und wartet auf Freigabe`,
    tag: 'task-submitted',
    data: { type: 'task-submitted', url: '/' }
  });
}

export async function notifyTaskApproved(childId: number, taskTitle: string, sats: number): Promise<void> {
  await sendPushToUser(childId, {
    title: 'Aufgabe genehmigt!',
    body: `Du hast ${sats} Sats für "${taskTitle}" verdient!`,
    tag: 'task-approved',
    data: { type: 'task-approved', url: '/' }
  });
}

export async function notifyPaymentReceived(childId: number, sats: number, reason: string): Promise<void> {
  await sendPushToUser(childId, {
    title: 'Zahlung erhalten!',
    body: `Du hast ${sats} Sats erhalten: ${reason}`,
    tag: 'payment-received',
    data: { type: 'payment-received', url: '/' }
  });
}

export async function notifyLevelUp(childId: number, newLevel: number, bonusSats: number): Promise<void> {
  await sendPushToUser(childId, {
    title: 'Level Up!',
    body: `Du bist jetzt Level ${newLevel}! Bonus: ${bonusSats} Sats`,
    tag: 'level-up',
    data: { type: 'level-up', url: '/' }
  });
}

export async function notifyGraduation(connectionId: string, childName: string): Promise<void> {
  await sendPushToFamily(connectionId, {
    title: 'Satoshi Guardian!',
    body: `${childName} hat die Bitcoin-Ausbildung abgeschlossen!`,
    tag: 'graduation',
    data: { type: 'graduation', url: '/' }
  });
}

export async function notifyNewEvent(connectionId: string, eventTitle: string, creatorId: number): Promise<void> {
  await sendPushToFamily(connectionId, {
    title: 'Neuer Termin',
    body: eventTitle,
    tag: 'new-event',
    data: { type: 'new-event', url: '/' }
  }, creatorId);
}

export async function notifyNewChatMessage(connectionId: string, senderName: string, message: string, senderId: number): Promise<void> {
  const shortMessage = message.length > 50 ? message.substring(0, 47) + '...' : message;
  await sendPushToFamily(connectionId, {
    title: `${senderName}`,
    body: shortMessage,
    tag: 'chat-message',
    data: { type: 'chat-message', url: '/' }
  }, senderId);
}

export async function notifyPaymentFailed(connectionId: string, childName: string, sats: number, paymentType: string, errorMessage: string): Promise<void> {
  const typeLabel = paymentType === 'task' ? 'Aufgabenzahlung' : paymentType === 'allowance' ? 'Taschengeld' : 'Sofortzahlung';
  await sendPushToParents(connectionId, {
    title: '⚠️ Zahlung fehlgeschlagen!',
    body: `${typeLabel} an ${childName} (${sats} Sats) konnte nicht durchgeführt werden`,
    tag: 'payment-failed',
    data: { type: 'payment-failed', url: '/', error: errorMessage }
  });
}
