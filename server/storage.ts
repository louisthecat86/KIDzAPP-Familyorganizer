import { db } from "./db";
import { type Peer, type InsertPeer, peers, type Task, type InsertTask, tasks, type Transaction, type InsertTransaction, transactions, type FamilyEvent, type InsertFamilyEvent, familyEvents, type EventRsvp, type InsertEventRsvp, eventRsvps, type ChatMessage, type InsertChatMessage, chatMessages, type Allowance, type InsertAllowance, allowances, type DailyBitcoinSnapshot, type InsertDailyBitcoinSnapshot, dailyBitcoinSnapshots, type MonthlySavingsSnapshot, type InsertMonthlySavingsSnapshot, monthlySavingsSnapshots, type LevelBonusSettings, type InsertLevelBonusSettings, levelBonusSettings, type LevelBonusPayout, type InsertLevelBonusPayout, levelBonusPayouts, type RecurringTask, type InsertRecurringTask, recurringTasks, type LearningProgress, type InsertLearningProgress, learningProgress, type DailyChallenge, dailyChallenges, type ShoppingList, type InsertShoppingList, shoppingList, type FamilyBoardPost, type InsertFamilyBoardPost, familyBoardPosts, type LocationPing, type InsertLocationPing, locationPings, type EmergencyContact, type InsertEmergencyContact, emergencyContacts, type PasswordSafeEntry, type InsertPasswordSafeEntry, passwordSafeEntries, type BirthdayReminder, type InsertBirthdayReminder, birthdayReminders, type FailedPayment, type InsertFailedPayment, failedPayments } from "@shared/schema";
import { eq, and, desc, lt, isNull, or, inArray } from "drizzle-orm";

export interface IStorage {
  // Peer operations
  getPeer(id: number): Promise<Peer | undefined>;
  getPeerByName(name: string): Promise<Peer | undefined>;
  getPeerByConnectionId(connectionId: string, role: string): Promise<Peer | undefined>;
  getPeerByNameAndPin(name: string, pin: string, role: string): Promise<Peer | undefined>;
  getPeerByNameAndRole(name: string, role: string): Promise<Peer | undefined>;
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
  getCompletedRequiredTasksCount(childId: number, connectionId: string): Promise<number>;
  getTaskUnlockStatus(childId: number, connectionId: string): Promise<{ familyTasksCompleted: number; paidTasksCompleted: number; freeSlots: number; progressToNext: number }>;
  
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

  // Graduation operations
  checkAndProcessGraduation(peerId: number, graduationBonusSats?: number): Promise<{ graduated: boolean; newProgress: LearningProgress | undefined; bonusPaid: boolean }>;
  claimGraduationBonus(peerId: number, bonusSats: number): Promise<{ success: boolean; newBalance: number }>;
  incrementMasteryStreak(peerId: number): Promise<LearningProgress | undefined>;

  // Shopping List operations
  getShoppingList(connectionId: string): Promise<ShoppingList[]>;
  createShoppingListItem(item: InsertShoppingList): Promise<ShoppingList>;
  updateShoppingListItem(id: number, updates: Partial<ShoppingList>): Promise<ShoppingList | undefined>;
  deleteShoppingListItem(id: number): Promise<boolean>;

  // Data Cleanup operations (PARENT ONLY - NEVER delete transactions/balances/XP)
  cleanupChatMessages(connectionId: string): Promise<number>;
  cleanupPhotoProofs(connectionId: string): Promise<number>;
  cleanupOldEvents(connectionId: string): Promise<number>;
  cleanupShoppingList(connectionId: string): Promise<number>;
  cleanupAllFamilyData(connectionId: string): Promise<{ chat: number; photos: number; events: number; shopping: number; tasks: number }>;
  resetAccountData(peerId: number): Promise<boolean>;
  deleteAccount(peerId: number, connectionId: string): Promise<{ success: boolean; wasLastParent: boolean; childrenDisconnected: number }>;
  
  // Connection management helpers
  getOtherParentsWithConnectionId(connectionId: string, excludePeerId: number): Promise<Peer[]>;
  getChildrenWithConnectionId(connectionId: string): Promise<Peer[]>;
  disconnectChildrenFromFamily(connectionId: string): Promise<number>;

  // Family Board operations
  getFamilyBoardPosts(connectionId: string): Promise<FamilyBoardPost[]>;
  createFamilyBoardPost(post: InsertFamilyBoardPost): Promise<FamilyBoardPost>;
  updateFamilyBoardPost(id: number, updates: Partial<FamilyBoardPost>): Promise<FamilyBoardPost | undefined>;
  deleteFamilyBoardPost(id: number): Promise<boolean>;

  // Location Pings operations
  getLocationPings(connectionId: string, limit?: number): Promise<LocationPing[]>;
  createLocationPing(ping: InsertLocationPing): Promise<LocationPing>;
  getChildLocationPings(childId: number, limit?: number): Promise<LocationPing[]>;

  // Emergency Contacts operations
  getEmergencyContacts(connectionId: string): Promise<EmergencyContact[]>;
  createEmergencyContact(contact: InsertEmergencyContact): Promise<EmergencyContact>;
  updateEmergencyContact(id: number, updates: Partial<EmergencyContact>): Promise<EmergencyContact | undefined>;
  deleteEmergencyContact(id: number): Promise<boolean>;

  // Password Safe operations
  getPasswordSafeEntries(connectionId: string): Promise<PasswordSafeEntry[]>;
  getPasswordSafeEntry(id: number): Promise<PasswordSafeEntry | undefined>;
  createPasswordSafeEntry(entry: InsertPasswordSafeEntry): Promise<PasswordSafeEntry>;
  updatePasswordSafeEntry(id: number, updates: Partial<PasswordSafeEntry>): Promise<PasswordSafeEntry | undefined>;
  deletePasswordSafeEntry(id: number): Promise<boolean>;

  // Birthday Reminders operations
  getBirthdayReminders(connectionId: string): Promise<BirthdayReminder[]>;
  getUpcomingBirthdays(connectionId: string, daysAhead?: number): Promise<BirthdayReminder[]>;
  createBirthdayReminder(reminder: InsertBirthdayReminder): Promise<BirthdayReminder>;
  updateBirthdayReminder(id: number, updates: Partial<BirthdayReminder>): Promise<BirthdayReminder | undefined>;
  deleteBirthdayReminder(id: number): Promise<boolean>;

  // Failed Payments operations
  getFailedPayments(connectionId: string): Promise<FailedPayment[]>;
  getPendingFailedPayments(connectionId: string): Promise<FailedPayment[]>;
  createFailedPayment(payment: InsertFailedPayment): Promise<FailedPayment>;
  updateFailedPayment(id: number, updates: Partial<FailedPayment>): Promise<FailedPayment | undefined>;
  markPaymentResolved(id: number): Promise<FailedPayment | undefined>;
  markPaymentRetried(id: number): Promise<FailedPayment | undefined>;
  deleteFailedPayment(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Peer operations
  async getPeer(id: number): Promise<Peer | undefined> {
    const result = await db.select().from(peers).where(eq(peers.id, id)).limit(1);
    return result[0];
  }

  async getPeerByName(name: string): Promise<Peer | undefined> {
    const result = await db.select().from(peers)
      .where(eq(peers.name, name))
      .limit(1);
    return result[0];
  }

  async getPeerByConnectionId(connectionId: string, role: string): Promise<Peer | undefined> {
    const result = await db.select().from(peers)
      .where(and(eq(peers.connectionId, connectionId), eq(peers.role, role)))
      .limit(1);
    return result[0];
  }

  async getPeerByNameAndPin(name: string, pin: string, role: string): Promise<Peer | undefined> {
    const result = await db.select().from(peers)
      .where(and(
        eq(peers.name, name),
        eq(peers.pin, pin),
        eq(peers.role, role)
      ))
      .limit(1);
    return result[0];
  }

  async getPeerByNameAndRole(name: string, role: string): Promise<Peer | undefined> {
    const result = await db.select().from(peers)
      .where(and(
        eq(peers.name, name),
        eq(peers.role, role)
      ))
      .limit(1);
    return result[0];
  }

  async getPeerByPin(pin: string): Promise<Peer | undefined> {
    const result = await db.select().from(peers)
      .where(eq(peers.pin, pin))
      .limit(1);
    
    const peer = result[0];
    if (peer && peer.role === "child") {
      // Wenn Kind mit Parent gekoppelt ist, stelle sicher dass familyName korrekt ist
      const parent = await db.select().from(peers)
        .where(and(eq(peers.connectionId, peer.connectionId), eq(peers.role, "parent")))
        .limit(1);
      
      if (parent[0] && parent[0].familyName !== peer.familyName) {
        // Aktualisiere familyName des Kindes
        const updated = await db.update(peers)
          .set({ familyName: parent[0].familyName })
          .where(eq(peers.id, peer.id))
          .returning();
        return updated[0];
      }
    }
    
    return peer;
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
    const result = await db.update(peers)
      .set({ lnbitsUrl, lnbitsAdminKey, walletType: lnbitsUrl ? "lnbits" : null })
      .where(eq(peers.id, peerId))
      .returning();
    return result[0];
  }

  async updatePeerNwcWallet(peerId: number, nwcConnectionString: string): Promise<Peer> {
    const result = await db.update(peers)
      .set({ nwcConnectionString, walletType: nwcConnectionString ? "nwc" : null })
      .where(eq(peers.id, peerId))
      .returning();
    return result[0];
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

  async getCompletedRequiredTasksCount(childId: number, connectionId: string): Promise<number> {
    const result = await db.select().from(tasks)
      .where(and(
        eq(tasks.assignedTo, childId),
        eq(tasks.connectionId, connectionId),
        eq(tasks.isRequired, true),
        eq(tasks.status, "approved")
      ));
    return result.length;
  }

  async getTaskUnlockStatus(childId: number, connectionId: string): Promise<{ familyTasksCompleted: number; paidTasksCompleted: number; freeSlots: number; progressToNext: number }> {
    const familyTasks = await db.select().from(tasks)
      .where(and(
        eq(tasks.assignedTo, childId),
        eq(tasks.connectionId, connectionId),
        eq(tasks.isRequired, true),
        eq(tasks.status, "approved")
      ));
    
    // Count both "assigned" (angenommen, noch nicht genehmigt) and "approved" (fertig, genehmigt) paid tasks
    // Diese "blockieren" einen freeSlot - ABER nicht wenn bypassRatio=true
    const paidTasks = await db.select().from(tasks)
      .where(and(
        eq(tasks.assignedTo, childId),
        eq(tasks.connectionId, connectionId),
        eq(tasks.isRequired, false)
      ));
    
    const familyTasksCompleted = familyTasks.length;
    // Count ONLY paid tasks that block ratio (not bypassed)
    const paidTasksInProgress = paidTasks.filter(t => 
      !t.bypassRatio && (t.status === "assigned" || t.status === "approved")
    ).length;
    const freeSlots = Math.floor(familyTasksCompleted / 3) - paidTasksInProgress;
    const progressToNext = familyTasksCompleted % 3;
    
    return { familyTasksCompleted, paidTasksCompleted: paidTasksInProgress, freeSlots: Math.max(0, freeSlots), progressToNext };
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
    // Get all transactions FROM this parent TO children
    const result = await db.select()
      .from(transactions)
      .where(eq(transactions.fromPeerId, peerId));
    
    // Sum all outgoing payments (task_payment, instant_payout, allowance_payout)
    return result.reduce((sum, t) => sum + t.sats, 0);
  }

  async getSatsSpentByChild(parentId: number, connectionId: string): Promise<Array<{ childId: number; childName: string; satSpent: number }>> {
    const children = await db.select().from(peers)
      .where(and(eq(peers.connectionId, connectionId), eq(peers.role, "child")));
    
    const result = [];
    for (const child of children) {
      // Get all transactions from this parent to this child
      const childTransactions = await db.select()
        .from(transactions)
        .where(and(
          eq(transactions.fromPeerId, parentId),
          eq(transactions.toPeerId, child.id)
        ));
      
      const satSpent = childTransactions.reduce((sum, t) => sum + t.sats, 0);
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

  async checkAndProcessGraduation(peerId: number, graduationBonusSats: number = 2100): Promise<{ graduated: boolean; newProgress: LearningProgress | undefined; bonusPaid: boolean }> {
    const progress = await this.getLearningProgress(peerId);
    if (!progress) {
      return { graduated: false, newProgress: undefined, bonusPaid: false };
    }

    if (progress.graduatedAt) {
      return { graduated: true, newProgress: progress, bonusPaid: progress.graduationBonusClaimed };
    }

    const completedModules = progress.completedModules || [];
    const requiredModules = 20;
    const requiredChallenges = 1;
    
    const actualChallengeRows = await db.select().from(dailyChallenges)
      .where(and(eq(dailyChallenges.peerId, peerId), eq(dailyChallenges.completed, true)));
    const verifiedChallengeCount = actualChallengeRows.length;
    
    if (completedModules.length >= requiredModules && verifiedChallengeCount >= requiredChallenges) {
      const result = await db.update(learningProgress)
        .set({ 
          graduatedAt: new Date(),
          guardianLevel: 1,
          dailyChallengesCompleted: verifiedChallengeCount,
          updatedAt: new Date()
        })
        .where(eq(learningProgress.peerId, peerId))
        .returning();
      
      return { graduated: true, newProgress: result[0], bonusPaid: false };
    }

    return { graduated: false, newProgress: progress, bonusPaid: false };
  }

  async claimGraduationBonus(peerId: number, bonusSats: number): Promise<{ success: boolean; newBalance: number }> {
    const progress = await this.getLearningProgress(peerId);
    if (!progress || !progress.graduatedAt || progress.graduationBonusClaimed) {
      return { success: false, newBalance: 0 };
    }

    await db.update(learningProgress)
      .set({ graduationBonusClaimed: true, updatedAt: new Date() })
      .where(eq(learningProgress.peerId, peerId));

    const peer = await this.getPeer(peerId);
    if (peer) {
      const newBalance = peer.balance + bonusSats;
      await db.update(peers)
        .set({ balance: newBalance })
        .where(eq(peers.id, peerId));
      return { success: true, newBalance };
    }

    return { success: false, newBalance: 0 };
  }

  async incrementMasteryStreak(peerId: number): Promise<LearningProgress | undefined> {
    const progress = await this.getLearningProgress(peerId);
    if (!progress || !progress.graduatedAt) return undefined;

    const newCount = (progress.masteryStreakCount || 0) + 1;
    let newGuardianLevel = progress.guardianLevel;
    
    if (newCount >= 30 && newGuardianLevel < 3) {
      newGuardianLevel = 3;
    } else if (newCount >= 10 && newGuardianLevel < 2) {
      newGuardianLevel = 2;
    }

    const result = await db.update(learningProgress)
      .set({ 
        masteryStreakCount: newCount,
        guardianLevel: newGuardianLevel,
        updatedAt: new Date()
      })
      .where(eq(learningProgress.peerId, peerId))
      .returning();
    return result[0];
  }

  // Shopping List operations
  async getShoppingList(connectionId: string): Promise<ShoppingList[]> {
    return await db.select().from(shoppingList)
      .where(eq(shoppingList.connectionId, connectionId))
      .orderBy(desc(shoppingList.createdAt));
  }

  async createShoppingListItem(item: InsertShoppingList): Promise<ShoppingList> {
    const result = await db.insert(shoppingList).values(item).returning();
    return result[0];
  }

  async updateShoppingListItem(id: number, updates: Partial<ShoppingList>): Promise<ShoppingList | undefined> {
    const result = await db.update(shoppingList)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(shoppingList.id, id))
      .returning();
    return result[0];
  }

  async deleteShoppingListItem(id: number): Promise<boolean> {
    const result = await db.delete(shoppingList).where(eq(shoppingList.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ============================================================
  // DATA CLEANUP OPERATIONS (PARENT ONLY)
  // CRITICAL: NEVER delete transactions, balances, or XP/Level data!
  // ============================================================

  async cleanupChatMessages(connectionId: string): Promise<number> {
    const result = await db.delete(chatMessages)
      .where(eq(chatMessages.connectionId, connectionId));
    return result.rowCount ?? 0;
  }

  async cleanupPhotoProofs(connectionId: string): Promise<number> {
    const result = await db.update(tasks)
      .set({ proof: null })
      .where(and(
        eq(tasks.connectionId, connectionId),
        eq(tasks.status, 'approved')
      ));
    return result.rowCount ?? 0;
  }

  async cleanupOldEvents(connectionId: string): Promise<number> {
    const now = new Date();
    const eventIds = await db.select({ id: familyEvents.id })
      .from(familyEvents)
      .where(and(
        eq(familyEvents.connectionId, connectionId),
        lt(familyEvents.startDate, now)
      ));
    
    if (eventIds.length > 0) {
      const ids = eventIds.map(e => e.id);
      await db.delete(eventRsvps).where(inArray(eventRsvps.eventId, ids));
    }
    
    const result = await db.delete(familyEvents)
      .where(and(
        eq(familyEvents.connectionId, connectionId),
        lt(familyEvents.startDate, now)
      ));
    return result.rowCount ?? 0;
  }

  async cleanupShoppingList(connectionId: string): Promise<number> {
    const result = await db.delete(shoppingList)
      .where(eq(shoppingList.connectionId, connectionId));
    return result.rowCount ?? 0;
  }

  async cleanupAllFamilyData(connectionId: string): Promise<{ chat: number; photos: number; events: number; shopping: number; tasks: number }> {
    const chat = await this.cleanupChatMessages(connectionId);
    const photos = await this.cleanupPhotoProofs(connectionId);
    const events = await this.cleanupOldEvents(connectionId);
    const shopping = await this.cleanupShoppingList(connectionId);
    
    const taskResult = await db.delete(tasks)
      .where(and(
        eq(tasks.connectionId, connectionId),
        or(
          eq(tasks.status, 'open'),
          eq(tasks.status, 'approved')
        )
      ));
    const tasksDeleted = taskResult.rowCount ?? 0;
    
    return { chat, photos, events, shopping, tasks: tasksDeleted };
  }

  async resetAccountData(peerId: number): Promise<boolean> {
    const peer = await this.getPeer(peerId);
    if (!peer) return false;

    await db.delete(chatMessages).where(eq(chatMessages.fromPeerId, peerId));
    
    await db.delete(eventRsvps).where(eq(eventRsvps.peerId, peerId));
    
    await db.delete(dailyChallenges).where(eq(dailyChallenges.peerId, peerId));
    
    if (peer.role === 'child') {
      await db.update(tasks)
        .set({ assignedTo: null, status: 'open', proof: null })
        .where(eq(tasks.assignedTo, peerId));
    }
    
    return true;
  }

  async getOtherParentsWithConnectionId(connectionId: string, excludePeerId: number): Promise<Peer[]> {
    return await db.select().from(peers)
      .where(and(
        eq(peers.connectionId, connectionId),
        eq(peers.role, 'parent'),
        // Exclude the peer being deleted
        // Using SQL to check NOT equal
      ));
  }

  async getChildrenWithConnectionId(connectionId: string): Promise<Peer[]> {
    return await db.select().from(peers)
      .where(and(
        eq(peers.connectionId, connectionId),
        eq(peers.role, 'child')
      ));
  }

  async disconnectChildrenFromFamily(connectionId: string): Promise<number> {
    const result = await db.update(peers)
      .set({ connectionId: null })
      .where(and(
        eq(peers.connectionId, connectionId),
        eq(peers.role, 'child')
      ));
    return result.rowCount ?? 0;
  }

  async deleteAccount(peerId: number, connectionId: string): Promise<{ success: boolean; wasLastParent: boolean; childrenDisconnected: number }> {
    const peer = await this.getPeer(peerId);
    if (!peer) return { success: false, wasLastParent: false, childrenDisconnected: 0 };

    let wasLastParent = false;
    let childrenDisconnected = 0;

    await db.delete(chatMessages).where(eq(chatMessages.fromPeerId, peerId));
    await db.delete(eventRsvps).where(eq(eventRsvps.peerId, peerId));
    await db.delete(dailyChallenges).where(eq(dailyChallenges.peerId, peerId));
    await db.delete(allowances).where(eq(allowances.childId, peerId));
    await db.delete(levelBonusPayouts).where(eq(levelBonusPayouts.childId, peerId));
    await db.delete(learningProgress).where(eq(learningProgress.peerId, peerId));
    await db.delete(dailyBitcoinSnapshots).where(eq(dailyBitcoinSnapshots.peerId, peerId));
    await db.delete(monthlySavingsSnapshots).where(eq(monthlySavingsSnapshots.peerId, peerId));
    await db.delete(shoppingList).where(eq(shoppingList.createdBy, peerId));
    
    await db.update(tasks)
      .set({ assignedTo: null, status: 'open', proof: null })
      .where(eq(tasks.assignedTo, peerId));
    
    if (peer.role === 'parent') {
      // Check if there are other parents in this family
      const otherParents = await db.select().from(peers)
        .where(and(
          eq(peers.connectionId, connectionId),
          eq(peers.role, 'parent')
        ));
      
      // Filter out the current peer being deleted
      const remainingParents = otherParents.filter(p => p.id !== peerId);
      
      if (remainingParents.length === 0) {
        // This is the LAST parent - disconnect all children
        wasLastParent = true;
        childrenDisconnected = await this.disconnectChildrenFromFamily(connectionId);
        
        // Also clean up family-wide settings since no parents remain
        await db.delete(recurringTasks).where(eq(recurringTasks.connectionId, connectionId));
        await db.delete(levelBonusSettings).where(eq(levelBonusSettings.connectionId, connectionId));
      }
      // If other parents remain, the connectionId stays with them - no action needed
      
      // Delete events created by this parent
      const eventIds = await db.select({ id: familyEvents.id })
        .from(familyEvents)
        .where(eq(familyEvents.createdBy, peerId));
      if (eventIds.length > 0) {
        const ids = eventIds.map(e => e.id);
        await db.delete(eventRsvps).where(inArray(eventRsvps.eventId, ids));
      }
      await db.delete(familyEvents).where(eq(familyEvents.createdBy, peerId));
      await db.delete(tasks).where(eq(tasks.createdBy, peerId));
    }
    
    await db.delete(peers).where(eq(peers.id, peerId));
    
    return { success: true, wasLastParent, childrenDisconnected };
  }

  // Family Board operations
  async getFamilyBoardPosts(connectionId: string): Promise<FamilyBoardPost[]> {
    return await db.select().from(familyBoardPosts)
      .where(eq(familyBoardPosts.connectionId, connectionId))
      .orderBy(desc(familyBoardPosts.pinned), desc(familyBoardPosts.createdAt));
  }

  async createFamilyBoardPost(post: InsertFamilyBoardPost): Promise<FamilyBoardPost> {
    const result = await db.insert(familyBoardPosts).values(post).returning();
    return result[0];
  }

  async updateFamilyBoardPost(id: number, updates: Partial<FamilyBoardPost>): Promise<FamilyBoardPost | undefined> {
    const result = await db.update(familyBoardPosts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(familyBoardPosts.id, id))
      .returning();
    return result[0];
  }

  async deleteFamilyBoardPost(id: number): Promise<boolean> {
    const result = await db.delete(familyBoardPosts).where(eq(familyBoardPosts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Location Pings operations
  async getLocationPings(connectionId: string, limit: number = 50): Promise<LocationPing[]> {
    return await db.select().from(locationPings)
      .where(eq(locationPings.connectionId, connectionId))
      .orderBy(desc(locationPings.createdAt))
      .limit(limit);
  }

  async createLocationPing(ping: InsertLocationPing): Promise<LocationPing> {
    const result = await db.insert(locationPings).values(ping).returning();
    return result[0];
  }

  async getChildLocationPings(childId: number, limit: number = 10): Promise<LocationPing[]> {
    return await db.select().from(locationPings)
      .where(eq(locationPings.childId, childId))
      .orderBy(desc(locationPings.createdAt))
      .limit(limit);
  }

  async deleteLocationPing(id: number): Promise<boolean> {
    const result = await db.delete(locationPings).where(eq(locationPings.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getLocationPing(id: number): Promise<LocationPing | undefined> {
    const result = await db.select().from(locationPings)
      .where(eq(locationPings.id, id))
      .limit(1);
    return result[0];
  }

  // Emergency Contacts operations
  async getEmergencyContacts(connectionId: string): Promise<EmergencyContact[]> {
    return await db.select().from(emergencyContacts)
      .where(eq(emergencyContacts.connectionId, connectionId))
      .orderBy(emergencyContacts.priority, emergencyContacts.label);
  }

  async createEmergencyContact(contact: InsertEmergencyContact): Promise<EmergencyContact> {
    const result = await db.insert(emergencyContacts).values(contact).returning();
    return result[0];
  }

  async updateEmergencyContact(id: number, updates: Partial<EmergencyContact>): Promise<EmergencyContact | undefined> {
    const result = await db.update(emergencyContacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emergencyContacts.id, id))
      .returning();
    return result[0];
  }

  async deleteEmergencyContact(id: number): Promise<boolean> {
    const result = await db.delete(emergencyContacts).where(eq(emergencyContacts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Password Safe operations
  async getPasswordSafeEntries(connectionId: string): Promise<PasswordSafeEntry[]> {
    return await db.select().from(passwordSafeEntries)
      .where(eq(passwordSafeEntries.connectionId, connectionId))
      .orderBy(passwordSafeEntries.category, passwordSafeEntries.label);
  }

  async getPasswordSafeEntry(id: number): Promise<PasswordSafeEntry | undefined> {
    const result = await db.select().from(passwordSafeEntries)
      .where(eq(passwordSafeEntries.id, id))
      .limit(1);
    return result[0];
  }

  async createPasswordSafeEntry(entry: InsertPasswordSafeEntry): Promise<PasswordSafeEntry> {
    const result = await db.insert(passwordSafeEntries).values(entry).returning();
    return result[0];
  }

  async updatePasswordSafeEntry(id: number, updates: Partial<PasswordSafeEntry>): Promise<PasswordSafeEntry | undefined> {
    const result = await db.update(passwordSafeEntries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(passwordSafeEntries.id, id))
      .returning();
    return result[0];
  }

  async deletePasswordSafeEntry(id: number): Promise<boolean> {
    const result = await db.delete(passwordSafeEntries).where(eq(passwordSafeEntries.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Birthday Reminders operations
  async getBirthdayReminders(connectionId: string): Promise<BirthdayReminder[]> {
    return await db.select().from(birthdayReminders)
      .where(eq(birthdayReminders.connectionId, connectionId))
      .orderBy(birthdayReminders.birthMonth, birthdayReminders.birthDay);
  }

  async getUpcomingBirthdays(connectionId: string, daysAhead: number = 30): Promise<BirthdayReminder[]> {
    const all = await this.getBirthdayReminders(connectionId);
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    
    return all.filter(b => {
      const thisYear = new Date(today.getFullYear(), b.birthMonth - 1, b.birthDay);
      const nextYear = new Date(today.getFullYear() + 1, b.birthMonth - 1, b.birthDay);
      
      const nextBirthday = thisYear >= today ? thisYear : nextYear;
      const daysUntil = Math.floor((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return daysUntil >= 0 && daysUntil <= daysAhead;
    }).sort((a, b) => {
      const getNextBirthday = (bd: BirthdayReminder) => {
        const thisYear = new Date(today.getFullYear(), bd.birthMonth - 1, bd.birthDay);
        const nextYear = new Date(today.getFullYear() + 1, bd.birthMonth - 1, bd.birthDay);
        return thisYear >= today ? thisYear : nextYear;
      };
      return getNextBirthday(a).getTime() - getNextBirthday(b).getTime();
    });
  }

  async createBirthdayReminder(reminder: InsertBirthdayReminder): Promise<BirthdayReminder> {
    const result = await db.insert(birthdayReminders).values(reminder).returning();
    return result[0];
  }

  async updateBirthdayReminder(id: number, updates: Partial<BirthdayReminder>): Promise<BirthdayReminder | undefined> {
    const result = await db.update(birthdayReminders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(birthdayReminders.id, id))
      .returning();
    return result[0];
  }

  async deleteBirthdayReminder(id: number): Promise<boolean> {
    const result = await db.delete(birthdayReminders).where(eq(birthdayReminders.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Failed Payments operations
  async getFailedPayments(connectionId: string): Promise<FailedPayment[]> {
    return await db.select().from(failedPayments)
      .where(eq(failedPayments.connectionId, connectionId))
      .orderBy(desc(failedPayments.createdAt));
  }

  async getPendingFailedPayments(connectionId: string): Promise<FailedPayment[]> {
    return await db.select().from(failedPayments)
      .where(and(
        eq(failedPayments.connectionId, connectionId),
        eq(failedPayments.status, "pending")
      ))
      .orderBy(desc(failedPayments.createdAt));
  }

  async createFailedPayment(payment: InsertFailedPayment): Promise<FailedPayment> {
    const result = await db.insert(failedPayments).values(payment).returning();
    return result[0];
  }

  async updateFailedPayment(id: number, updates: Partial<FailedPayment>): Promise<FailedPayment | undefined> {
    const result = await db.update(failedPayments)
      .set(updates)
      .where(eq(failedPayments.id, id))
      .returning();
    return result[0];
  }

  async markPaymentResolved(id: number): Promise<FailedPayment | undefined> {
    const result = await db.update(failedPayments)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(failedPayments.id, id))
      .returning();
    return result[0];
  }

  async markPaymentRetried(id: number): Promise<FailedPayment | undefined> {
    const current = await db.select().from(failedPayments).where(eq(failedPayments.id, id)).limit(1);
    if (!current[0]) return undefined;
    
    const result = await db.update(failedPayments)
      .set({ 
        status: "retried", 
        retryCount: (current[0].retryCount || 0) + 1,
        lastRetryAt: new Date() 
      })
      .where(eq(failedPayments.id, id))
      .returning();
    return result[0];
  }

  async deleteFailedPayment(id: number): Promise<boolean> {
    const result = await db.delete(failedPayments).where(eq(failedPayments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

}

export const storage = new DatabaseStorage();
