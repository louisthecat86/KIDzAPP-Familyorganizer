import { db } from "./db";
import { type Peer, type InsertPeer, peers, type Task, type InsertTask, tasks, type Transaction, type InsertTransaction, transactions, type FamilyEvent, type InsertFamilyEvent, familyEvents, type EventRsvp, type InsertEventRsvp, eventRsvps, type ChatMessage, type InsertChatMessage, chatMessages, type Allowance, type InsertAllowance, allowances, type DailyBitcoinSnapshot, type InsertDailyBitcoinSnapshot, dailyBitcoinSnapshots, type MonthlySavingsSnapshot, type InsertMonthlySavingsSnapshot, monthlySavingsSnapshots, type LevelBonusSettings, type InsertLevelBonusSettings, levelBonusSettings, type LevelBonusPayout, type InsertLevelBonusPayout, levelBonusPayouts, type RecurringTask, type InsertRecurringTask, recurringTasks, type LearningProgress, type InsertLearningProgress, learningProgress, type DailyChallenge, dailyChallenges } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { encrypt, decrypt } from "./crypto";

function decryptPeerSecrets(peer: Peer | undefined): Peer | undefined {
  if (!peer) return peer;
  return {
    ...peer,
    lnbitsAdminKey: peer.lnbitsAdminKey ? decrypt(peer.lnbitsAdminKey) : null,
    nwcConnectionString: peer.nwcConnectionString ? decrypt(peer.nwcConnectionString) : null,
  };
}

export interface IStorage {
  // Peer operations
  getPeer(id: number): Promise<Peer | undefined>;
  getPeerByName(name: string): Promise<Peer | undefined>;
  getPeerByConnectionId(connectionId: string, role: string): Promise<Peer | undefined>;
  getPeerByNameAndPin(name: string, pin: string, role: string): Promise<Peer | undefined>;
  getPeerByPin(pin: string): Promise<Peer | undefined>;
  getAllParents(): Promise<Peer[]>;
  createPeer(peer: InsertPeer): Promise<Peer>;
  linkChildToParent(childId: number, parentConnectionId: string): Promise<Peer>;
  updatePeerWallet(peerId: number, lnbitsUrl: string, lnbitsAdminKey: string): Promise<Peer>;
  updatePeerNwcWallet(peerId: number, nwcConnectionString: string): Promise<Peer>;
  updatePeerWalletType(peerId: number, walletType: string): Promise<Peer>;
  clearPeerNwcWallet(peerId: number): Promise<Peer>;
  updateBalance(peerId: number, sats: number): Promise<Peer>;
  updatePeerPin(peerId: number, newPin: string): Promise<Peer>;
  updatePeerFamilyName(peerId: number, familyName: string): Promise<Peer>;
  updateChildLightningAddress(peerId: number, lightningAddress: string): Promise<Peer>;
  updateDonationAddress(peerId: number, donationAddress: string): Promise<Peer>;
  getSatsSpentByChild(parentId: number, connectionId: string): Promise<Array<{ childId: number; childName: string; satSpent: number }>>;
  
  // Task operations
  getTasks(connectionId: string): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactions(peerId: number): Promise<Transaction[]>;
  
  // Family Events operations
  getFamilyEvents(connectionId: string): Promise<FamilyEvent[]>;
  getEvent(id: number): Promise<FamilyEvent | undefined>;
  createEvent(event: InsertFamilyEvent): Promise<FamilyEvent>;
  updateEvent(id: number, event: Partial<FamilyEvent>): Promise<FamilyEvent | undefined>;
  deleteEvent(id: number): Promise<boolean>;

  // Event RSVP operations
  getRsvpsByEvent(eventId: number): Promise<EventRsvp[]>;
  getRsvpForUserEvent(peerId: number, eventId: number): Promise<EventRsvp | undefined>;
  createOrUpdateRsvp(peerId: number, eventId: number, response: string): Promise<EventRsvp>;

  // Chat Message operations
  getChatMessages(connectionId: string): Promise<(ChatMessage & { senderName: string })[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Allowance operations
  getAllowances(connectionId: string): Promise<Allowance[]>;
  getAllowancesByChild(childId: number): Promise<Allowance[]>;
  createAllowance(allowance: InsertAllowance): Promise<Allowance>;
  updateAllowance(id: number, allowance: Partial<Allowance>): Promise<Allowance | undefined>;
  deleteAllowance(id: number): Promise<boolean>;
  getLastPaymentDate(allowanceId: number): Promise<Date | null>;

  // Get children for parent
  getChildrenForParent(parentId: number): Promise<Peer[]>;

  // Daily Bitcoin Snapshots operations
  getDailyBitcoinSnapshots(peerId: number): Promise<DailyBitcoinSnapshot[]>;
  createDailyBitcoinSnapshot(snapshot: InsertDailyBitcoinSnapshot): Promise<DailyBitcoinSnapshot>;
  getLastDailySnapshot(peerId: number): Promise<DailyBitcoinSnapshot | undefined>;

  // Monthly Savings Snapshots operations
  getMonthlySavingsSnapshots(peerId: number): Promise<MonthlySavingsSnapshot[]>;
  createMonthlySavingsSnapshot(snapshot: InsertMonthlySavingsSnapshot): Promise<MonthlySavingsSnapshot>;
  getLastMonthlySavingsSnapshot(peerId: number): Promise<MonthlySavingsSnapshot | undefined>;

  // Level Bonus operations
  getLevelBonusSettings(connectionId: string): Promise<LevelBonusSettings | undefined>;
  createOrUpdateLevelBonusSettings(settings: InsertLevelBonusSettings): Promise<LevelBonusSettings>;
  getLevelBonusPayouts(childId: number): Promise<LevelBonusPayout[]>;
  createLevelBonusPayout(payout: InsertLevelBonusPayout): Promise<LevelBonusPayout>;
  hasLevelBonusBeenPaid(childId: number, level: number): Promise<boolean>;

  // Recurring Tasks operations
  getRecurringTasks(connectionId: string): Promise<RecurringTask[]>;
  getRecurringTask(id: number): Promise<RecurringTask | undefined>;
  createRecurringTask(task: InsertRecurringTask): Promise<RecurringTask>;
  updateRecurringTask(id: number, task: Partial<RecurringTask>): Promise<RecurringTask | undefined>;
  deleteRecurringTask(id: number): Promise<boolean>;

  // Learning Progress operations
  getLearningProgress(peerId: number): Promise<LearningProgress | undefined>;
  createLearningProgress(progress: InsertLearningProgress): Promise<LearningProgress>;
  updateLearningProgress(peerId: number, progress: Partial<LearningProgress>): Promise<LearningProgress | undefined>;
  addXpAndCheckLevel(peerId: number, xpToAdd: number): Promise<LearningProgress>;
  unlockAchievement(peerId: number, achievementId: string): Promise<LearningProgress>;
  completeModule(peerId: number, moduleId: string): Promise<LearningProgress>;
  updateStreak(peerId: number): Promise<LearningProgress>;

  // Daily Challenge operations
  getTodayChallenge(peerId: number, challengeDate: string): Promise<any | undefined>;
  completeTodayChallenge(peerId: number, challengeDate: string, challengeType: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // Peer operations
  async getPeer(id: number): Promise<Peer | undefined> {
    const result = await db.select().from(peers).where(eq(peers.id, id)).limit(1);
    return decryptPeerSecrets(result[0]);
  }

  async getPeerByName(name: string): Promise<Peer | undefined> {
    const result = await db.select().from(peers)
      .where(eq(peers.name, name))
      .limit(1);
    return decryptPeerSecrets(result[0]);
  }

  async getPeerByConnectionId(connectionId: string, role: string): Promise<Peer | undefined> {
    const result = await db.select().from(peers)
      .where(and(eq(peers.connectionId, connectionId), eq(peers.role, role)))
      .limit(1);
    return decryptPeerSecrets(result[0]);
  }

  async getPeerByNameAndPin(name: string, pin: string, role: string): Promise<Peer | undefined> {
    const result = await db.select().from(peers)
      .where(and(
        eq(peers.name, name),
        eq(peers.pin, pin),
        eq(peers.role, role)
      ))
      .limit(1);
    return decryptPeerSecrets(result[0]);
  }

  async getPeerByPin(pin: string): Promise<Peer | undefined> {
    const result = await db.select().from(peers)
      .where(eq(peers.pin, pin))
      .limit(1);
    
    const peer = result[0];
    if (peer && peer.role === "child") {
      const parent = await db.select().from(peers)
        .where(and(eq(peers.connectionId, peer.connectionId), eq(peers.role, "parent")))
        .limit(1);
      
      if (parent[0] && parent[0].familyName !== peer.familyName) {
        const updated = await db.update(peers)
          .set({ familyName: parent[0].familyName })
          .where(eq(peers.id, peer.id))
          .returning();
        return decryptPeerSecrets(updated[0]);
      }
    }
    
    return decryptPeerSecrets(peer);
  }

  async getAllParents(): Promise<Peer[]> {
    return await db.select().from(peers).where(eq(peers.role, "parent"));
  }

  async getPeersByConnectionId(connectionId: string): Promise<Peer[]> {
    return await db.select().from(peers).where(eq(peers.connectionId, connectionId));
  }

  async createPeer(insertPeer: InsertPeer): Promise<Peer> {
    const result = await db.insert(peers).values(insertPeer).returning();
    return result[0];
  }

  async linkChildToParent(childId: number, parentConnectionId: string): Promise<Peer> {
    // Get parent familyName from connectionId
    const parent = await db.select().from(peers)
      .where(and(eq(peers.connectionId, parentConnectionId), eq(peers.role, "parent")))
      .limit(1);
    
    const result = await db.update(peers)
      .set({ 
        connectionId: parentConnectionId,
        familyName: parent[0]?.familyName // Store parent's familyName
      })
      .where(eq(peers.id, childId))
      .returning();
    return result[0];
  }

  async unlinkChildFromParent(childId: number): Promise<Peer> {
    const child = await db.select().from(peers).where(eq(peers.id, childId)).limit(1);
    const newConnectionId = `BTC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const result = await db.update(peers)
      .set({ 
        connectionId: newConnectionId,
        familyName: null
      })
      .where(eq(peers.id, childId))
      .returning();
    return result[0];
  }

  async updatePeerWallet(peerId: number, lnbitsUrl: string, lnbitsAdminKey: string): Promise<Peer> {
    const encryptedKey = lnbitsAdminKey ? encrypt(lnbitsAdminKey) : null;
    const result = await db.update(peers)
      .set({ lnbitsUrl, lnbitsAdminKey: encryptedKey, walletType: lnbitsUrl ? "lnbits" : null })
      .where(eq(peers.id, peerId))
      .returning();
    console.log(`[Security] Wallet credentials encrypted for peer ${peerId}`);
    return decryptPeerSecrets(result[0]) as Peer;
  }

  async updatePeerNwcWallet(peerId: number, nwcConnectionString: string): Promise<Peer> {
    const encryptedString = nwcConnectionString ? encrypt(nwcConnectionString) : null;
    const result = await db.update(peers)
      .set({ nwcConnectionString: encryptedString, walletType: nwcConnectionString ? "nwc" : null })
      .where(eq(peers.id, peerId))
      .returning();
    console.log(`[Security] NWC connection string encrypted for peer ${peerId}`);
    return decryptPeerSecrets(result[0]) as Peer;
  }

  async updatePeerWalletType(peerId: number, walletType: string): Promise<Peer> {
    const result = await db.update(peers)
      .set({ walletType })
      .where(eq(peers.id, peerId))
      .returning();
    return result[0];
  }

  async clearPeerNwcWallet(peerId: number): Promise<Peer> {
    const result = await db.update(peers)
      .set({ nwcConnectionString: null })
      .where(eq(peers.id, peerId))
      .returning();
    return result[0];
  }

  async updateBalance(peerId: number, sats: number): Promise<Peer> {
    const result = await db.update(peers)
      .set({ balance: sats })
      .where(eq(peers.id, peerId))
      .returning();
    return result[0];
  }

  async updatePeerPin(peerId: number, newPin: string): Promise<Peer> {
    const result = await db.update(peers)
      .set({ pin: newPin })
      .where(eq(peers.id, peerId))
      .returning();
    return result[0];
  }

  async updatePeerFamilyName(peerId: number, familyName: string): Promise<Peer> {
    const result = await db.update(peers)
      .set({ familyName })
      .where(eq(peers.id, peerId))
      .returning();
    return result[0];
  }

  async updateChildLightningAddress(peerId: number, lightningAddress: string): Promise<Peer> {
    const result = await db.update(peers)
      .set({ lightningAddress })
      .where(eq(peers.id, peerId))
      .returning();
    return result[0];
  }

  async updateDonationAddress(peerId: number, donationAddress: string): Promise<Peer> {
    const result = await db.update(peers)
      .set({ donationAddress })
      .where(eq(peers.id, peerId))
      .returning();
    return result[0];
  }

  // Task operations
  async getTasks(connectionId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.connectionId, connectionId));
  }

  async getTask(id: number): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return result[0];
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values(insertTask).returning();
    return result[0];
  }

  async updateTask(id: number, updates: Partial<Task>): Promise<Task | undefined> {
    const result = await db.update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return result[0];
  }

  async deleteTask(id: number): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getLeaderboard(connectionId: string): Promise<Array<{ id: number; name: string; completedTasks: number; balance: number; satsEarned: number }>> {
    const result = await db.select({
      id: peers.id,
      name: peers.name,
      balance: peers.balance,
    }).from(peers)
      .where(and(eq(peers.connectionId, connectionId), eq(peers.role, "child")));

    const leaderboard = [];
    for (const child of result) {
      const childTasks = await db.select().from(tasks)
        .where(and(eq(tasks.connectionId, connectionId), eq(tasks.assignedTo, child.id), eq(tasks.status, "approved")));
      
      const satsEarned = childTasks.reduce((sum, t) => sum + t.sats, 0);
      
      leaderboard.push({
        id: child.id,
        name: child.name,
        completedTasks: childTasks.length,
        balance: child.balance || 0,
        satsEarned: satsEarned,
      });
    }

    return leaderboard.sort((a, b) => b.satsEarned - a.satsEarned);
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const result = await db.insert(transactions).values(transaction).returning();
    return result[0];
  }

  async getTransactions(peerId: number): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(eq(transactions.toPeerId, peerId));
  }
  
  // Family Events operations
  async getFamilyEvents(connectionId: string): Promise<FamilyEvent[]> {
    return await db.select().from(familyEvents).where(eq(familyEvents.connectionId, connectionId));
  }

  async getEvent(id: number): Promise<FamilyEvent | undefined> {
    const result = await db.select().from(familyEvents).where(eq(familyEvents.id, id)).limit(1);
    return result[0];
  }

  async createEvent(insertEvent: InsertFamilyEvent): Promise<FamilyEvent> {
    const eventData = {
      ...insertEvent,
      startDate: insertEvent.startDate instanceof Date ? insertEvent.startDate : new Date(insertEvent.startDate as string),
      endDate: insertEvent.endDate instanceof Date ? insertEvent.endDate : (insertEvent.endDate ? new Date(insertEvent.endDate as string) : undefined),
    };
    const result = await db.insert(familyEvents).values([eventData]).returning();
    return result[0];
  }

  async updateEvent(id: number, updates: Partial<FamilyEvent>): Promise<FamilyEvent | undefined> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    if (updateData.startDate && !(updateData.startDate instanceof Date)) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate && !(updateData.endDate instanceof Date)) {
      updateData.endDate = new Date(updateData.endDate);
    }
    const result = await db.update(familyEvents)
      .set(updateData)
      .where(eq(familyEvents.id, id))
      .returning();
    return result[0];
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await db.delete(familyEvents).where(eq(familyEvents.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getSatsSpentByParent(peerId: number, connectionId: string): Promise<number> {
    const result = await db.select().from(tasks)
      .where(and(
        eq(tasks.createdBy, peerId), 
        eq(tasks.connectionId, connectionId),
        eq(tasks.status, "approved")  // ONLY count approved tasks!
      ));
    return result.reduce((sum, t) => sum + t.sats, 0);
  }

  async getSatsSpentByChild(parentId: number, connectionId: string): Promise<Array<{ childId: number; childName: string; satSpent: number }>> {
    const children = await db.select().from(peers)
      .where(and(eq(peers.connectionId, connectionId), eq(peers.role, "child")));
    
    const result = [];
    for (const child of children) {
      const childTasks = await db.select().from(tasks)
        .where(and(
          eq(tasks.createdBy, parentId),
          eq(tasks.connectionId, connectionId),
          eq(tasks.assignedTo, child.id),
          eq(tasks.status, "approved")
        ));
      
      const satSpent = childTasks.reduce((sum, t) => sum + t.sats, 0);
      if (satSpent > 0) {
        result.push({
          childId: child.id,
          childName: child.name,
          satSpent
        });
      }
    }
    
    return result.sort((a, b) => b.satSpent - a.satSpent);
  }

  // Event RSVP operations
  async getRsvpsByEvent(eventId: number): Promise<EventRsvp[]> {
    return await db.select().from(eventRsvps).where(eq(eventRsvps.eventId, eventId));
  }

  async getRsvpForUserEvent(peerId: number, eventId: number): Promise<EventRsvp | undefined> {
    const result = await db.select().from(eventRsvps)
      .where(and(eq(eventRsvps.peerId, peerId), eq(eventRsvps.eventId, eventId)))
      .limit(1);
    return result[0];
  }

  async createOrUpdateRsvp(peerId: number, eventId: number, response: string): Promise<EventRsvp> {
    const existing = await this.getRsvpForUserEvent(peerId, eventId);
    
    if (existing) {
      const result = await db.update(eventRsvps)
        .set({ response, updatedAt: new Date() })
        .where(and(eq(eventRsvps.peerId, peerId), eq(eventRsvps.eventId, eventId)))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(eventRsvps).values({
        peerId,
        eventId,
        response,
      }).returning();
      return result[0];
    }
  }

  // Chat Message operations
  async getChatMessages(connectionId: string): Promise<(ChatMessage & { senderName: string })[]> {
    const messages = await db.select({
      id: chatMessages.id,
      connectionId: chatMessages.connectionId,
      fromPeerId: chatMessages.fromPeerId,
      message: chatMessages.message,
      createdAt: chatMessages.createdAt,
      senderName: peers.name,
    }).from(chatMessages)
    .leftJoin(peers, eq(chatMessages.fromPeerId, peers.id))
    .where(eq(chatMessages.connectionId, connectionId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(50);
    return messages.map(m => ({ ...m, senderName: m.senderName || "Unknown" })).reverse();
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(chatMessages).values(message).returning();
    return result[0];
  }

  // Allowance operations
  async getAllowances(connectionId: string): Promise<Allowance[]> {
    return await db.select().from(allowances).where(eq(allowances.connectionId, connectionId));
  }

  async getAllowancesByChild(childId: number): Promise<Allowance[]> {
    return await db.select().from(allowances).where(eq(allowances.childId, childId));
  }

  async createAllowance(allowance: InsertAllowance): Promise<Allowance> {
    const result = await db.insert(allowances).values(allowance).returning();
    return result[0];
  }

  async updateAllowance(id: number, allowance: Partial<Allowance>): Promise<Allowance | undefined> {
    const result = await db.update(allowances)
      .set({ ...allowance, updatedAt: new Date() })
      .where(eq(allowances.id, id))
      .returning();
    return result[0];
  }

  async deleteAllowance(id: number): Promise<boolean> {
    const result = await db.delete(allowances).where(eq(allowances.id, id));
    return result.rowCount > 0;
  }

  async getLastPaymentDate(allowanceId: number): Promise<Date | null> {
    const result = await db.select({ lastPaidDate: allowances.lastPaidDate })
      .from(allowances)
      .where(eq(allowances.id, allowanceId))
      .limit(1);
    return result[0]?.lastPaidDate || null;
  }

  async getChildrenForParent(parentId: number): Promise<Peer[]> {
    const parent = await db.select().from(peers).where(eq(peers.id, parentId)).limit(1);
    if (!parent[0]) return [];
    
    const parentConnectionId = parent[0].connectionId;
    
    // Find all children with the same connectionId
    const children = await db.select().from(peers)
      .where(and(
        eq(peers.connectionId, parentConnectionId),
        eq(peers.role, "child")
      ));
    
    return children;
  }

  async getChildrenWithAllowances(parentId: number, connectionId: string): Promise<Array<{
    child: Peer;
    allowances: Allowance[];
  }>> {
    const childAllowances = await db.select()
      .from(allowances)
      .where(and(eq(allowances.parentId, parentId), eq(allowances.connectionId, connectionId), eq(allowances.isActive, true)));

    const result = [];
    for (const allowance of childAllowances) {
      const childResult = await db.select().from(peers).where(eq(peers.id, allowance.childId)).limit(1);
      if (childResult[0]) {
        const existing = result.find(r => r.child.id === allowance.childId);
        if (existing) {
          existing.allowances.push(allowance);
        } else {
          result.push({
            child: childResult[0],
            allowances: [allowance]
          });
        }
      }
    }
    return result;
  }

  async getDailyBitcoinSnapshots(peerId: number): Promise<DailyBitcoinSnapshot[]> {
    const result = await db.select().from(dailyBitcoinSnapshots)
      .where(eq(dailyBitcoinSnapshots.peerId, peerId))
      .orderBy(desc(dailyBitcoinSnapshots.createdAt));
    // Reverse to get oldest first for chart display
    return result.reverse();
  }

  async createDailyBitcoinSnapshot(snapshot: InsertDailyBitcoinSnapshot): Promise<DailyBitcoinSnapshot> {
    const result = await db.insert(dailyBitcoinSnapshots).values(snapshot).returning();
    return result[0];
  }

  async getLastDailySnapshot(peerId: number): Promise<DailyBitcoinSnapshot | undefined> {
    const result = await db.select().from(dailyBitcoinSnapshots)
      .where(eq(dailyBitcoinSnapshots.peerId, peerId))
      .orderBy(desc(dailyBitcoinSnapshots.createdAt))
      .limit(1);
    return result[0];
  }

  async getMonthlySavingsSnapshots(peerId: number): Promise<MonthlySavingsSnapshot[]> {
    const result = await db.select().from(monthlySavingsSnapshots)
      .where(eq(monthlySavingsSnapshots.peerId, peerId))
      .orderBy(desc(monthlySavingsSnapshots.createdAt));
    // Reverse to get oldest first for chart display
    return result.reverse();
  }

  async createMonthlySavingsSnapshot(snapshot: InsertMonthlySavingsSnapshot): Promise<MonthlySavingsSnapshot> {
    const result = await db.insert(monthlySavingsSnapshots).values(snapshot).returning();
    return result[0];
  }

  async getLastMonthlySavingsSnapshot(peerId: number): Promise<MonthlySavingsSnapshot | undefined> {
    const result = await db.select().from(monthlySavingsSnapshots)
      .where(eq(monthlySavingsSnapshots.peerId, peerId))
      .orderBy(desc(monthlySavingsSnapshots.createdAt))
      .limit(1);
    return result[0];
  }

  // Level Bonus operations
  async getLevelBonusSettings(connectionId: string): Promise<LevelBonusSettings | undefined> {
    const result = await db.select().from(levelBonusSettings)
      .where(eq(levelBonusSettings.connectionId, connectionId))
      .limit(1);
    return result[0];
  }

  async createOrUpdateLevelBonusSettings(settings: InsertLevelBonusSettings): Promise<LevelBonusSettings> {
    const existing = await this.getLevelBonusSettings(settings.connectionId);
    
    if (existing) {
      const result = await db.update(levelBonusSettings)
        .set({ 
          bonusSats: settings.bonusSats,
          milestoneInterval: settings.milestoneInterval,
          isActive: settings.isActive,
          updatedAt: new Date()
        })
        .where(eq(levelBonusSettings.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(levelBonusSettings).values(settings).returning();
      return result[0];
    }
  }

  async getLevelBonusPayouts(childId: number): Promise<LevelBonusPayout[]> {
    return await db.select().from(levelBonusPayouts)
      .where(eq(levelBonusPayouts.childId, childId))
      .orderBy(desc(levelBonusPayouts.paidAt));
  }

  async createLevelBonusPayout(payout: InsertLevelBonusPayout): Promise<LevelBonusPayout> {
    const result = await db.insert(levelBonusPayouts).values(payout).returning();
    return result[0];
  }

  async hasLevelBonusBeenPaid(childId: number, level: number): Promise<boolean> {
    const result = await db.select().from(levelBonusPayouts)
      .where(and(
        eq(levelBonusPayouts.childId, childId),
        eq(levelBonusPayouts.level, level)
      ))
      .limit(1);
    return result.length > 0;
  }

  async getRecurringTasks(connectionId: string): Promise<RecurringTask[]> {
    return await db.select().from(recurringTasks)
      .where(eq(recurringTasks.connectionId, connectionId))
      .orderBy(desc(recurringTasks.createdAt));
  }

  async getRecurringTask(id: number): Promise<RecurringTask | undefined> {
    const result = await db.select().from(recurringTasks).where(eq(recurringTasks.id, id)).limit(1);
    return result[0];
  }

  async createRecurringTask(task: InsertRecurringTask): Promise<RecurringTask> {
    const result = await db.insert(recurringTasks).values(task).returning();
    return result[0];
  }

  async updateRecurringTask(id: number, updates: Partial<RecurringTask>): Promise<RecurringTask | undefined> {
    const result = await db.update(recurringTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(recurringTasks.id, id))
      .returning();
    return result[0];
  }

  async deleteRecurringTask(id: number): Promise<boolean> {
    const result = await db.delete(recurringTasks).where(eq(recurringTasks.id, id));
    return true;
  }

  // Learning Progress operations
  async getLearningProgress(peerId: number): Promise<LearningProgress | undefined> {
    const result = await db.select().from(learningProgress)
      .where(eq(learningProgress.peerId, peerId))
      .limit(1);
    return result[0];
  }

  async createLearningProgress(progress: InsertLearningProgress): Promise<LearningProgress> {
    const result = await db.insert(learningProgress).values(progress).returning();
    return result[0];
  }

  async updateLearningProgress(peerId: number, updates: Partial<LearningProgress>): Promise<LearningProgress | undefined> {
    const result = await db.update(learningProgress)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(learningProgress.peerId, peerId))
      .returning();
    return result[0];
  }

  async addXpAndCheckLevel(peerId: number, xpToAdd: number): Promise<LearningProgress> {
    let progress = await this.getLearningProgress(peerId);
    
    if (!progress) {
      progress = await this.createLearningProgress({ peerId, xp: 0, level: 1, streak: 0, longestStreak: 0 });
    }

    const newXp = progress.xp + xpToAdd;
    const xpThresholds = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000, 5000];
    let newLevel = 1;
    for (let i = xpThresholds.length - 1; i >= 0; i--) {
      if (newXp >= xpThresholds[i]) {
        newLevel = i + 1;
        break;
      }
    }

    const result = await db.update(learningProgress)
      .set({ xp: newXp, level: newLevel, updatedAt: new Date() })
      .where(eq(learningProgress.peerId, peerId))
      .returning();
    return result[0];
  }

  async unlockAchievement(peerId: number, achievementId: string): Promise<LearningProgress> {
    let progress = await this.getLearningProgress(peerId);
    
    if (!progress) {
      progress = await this.createLearningProgress({ peerId, xp: 0, level: 1, streak: 0, longestStreak: 0 });
    }

    const currentAchievements = progress.unlockedAchievements || [];
    if (!currentAchievements.includes(achievementId)) {
      const result = await db.update(learningProgress)
        .set({ 
          unlockedAchievements: [...currentAchievements, achievementId],
          updatedAt: new Date() 
        })
        .where(eq(learningProgress.peerId, peerId))
        .returning();
      return result[0];
    }
    return progress;
  }

  async completeModule(peerId: number, moduleId: string): Promise<LearningProgress> {
    let progress = await this.getLearningProgress(peerId);
    
    if (!progress) {
      progress = await this.createLearningProgress({ peerId, xp: 0, level: 1, streak: 0, longestStreak: 0 });
    }

    const currentModules = progress.completedModules || [];
    if (!currentModules.includes(moduleId)) {
      const result = await db.update(learningProgress)
        .set({ 
          completedModules: [...currentModules, moduleId],
          totalQuizzesPassed: progress.totalQuizzesPassed + 1,
          updatedAt: new Date() 
        })
        .where(eq(learningProgress.peerId, peerId))
        .returning();
      return result[0];
    }
    return progress;
  }

  async updateStreak(peerId: number): Promise<LearningProgress> {
    let progress = await this.getLearningProgress(peerId);
    
    if (!progress) {
      progress = await this.createLearningProgress({ peerId, xp: 0, level: 1, streak: 1, longestStreak: 1, lastActivityDate: new Date() });
      return progress;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastActivity = progress.lastActivityDate ? new Date(progress.lastActivityDate) : null;
    if (lastActivity) {
      lastActivity.setHours(0, 0, 0, 0);
    }

    let newStreak = progress.streak;
    let newLongestStreak = progress.longestStreak;

    if (!lastActivity) {
      newStreak = 1;
    } else {
      const diffDays = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        // Same day, no streak change
      } else if (diffDays === 1) {
        newStreak = progress.streak + 1;
      } else {
        newStreak = 1; // Streak broken
      }
    }

    if (newStreak > newLongestStreak) {
      newLongestStreak = newStreak;
    }

    const result = await db.update(learningProgress)
      .set({ 
        streak: newStreak, 
        longestStreak: newLongestStreak,
        lastActivityDate: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(learningProgress.peerId, peerId))
      .returning();
    return result[0];
  }

  // Daily Challenge operations
  async getTodayChallenge(peerId: number, challengeDate: string): Promise<any | undefined> {
    const result = await db.select().from(dailyChallenges)
      .where(and(eq(dailyChallenges.peerId, peerId), eq(dailyChallenges.challengeDate, challengeDate)))
      .limit(1);
    return result[0];
  }

  async completeTodayChallenge(peerId: number, challengeDate: string, challengeType: string): Promise<any> {
    const existing = await this.getTodayChallenge(peerId, challengeDate);
    if (existing) {
      const result = await db.update(dailyChallenges)
        .set({ completed: true })
        .where(eq(dailyChallenges.id, existing.id))
        .returning();
      return result[0];
    }
    const result = await db.insert(dailyChallenges)
      .values({ peerId, challengeDate, challengeType, completed: true })
      .returning();
    return result[0];
  }

}

export const storage = new DatabaseStorage();
