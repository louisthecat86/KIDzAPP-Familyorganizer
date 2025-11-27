import { db } from "./db";
import { type Peer, type InsertPeer, peers, type Task, type InsertTask, tasks, type Transaction, type InsertTransaction, transactions, type FamilyEvent, type InsertFamilyEvent, familyEvents, type EventRsvp, type InsertEventRsvp, eventRsvps, type ChatMessage, type InsertChatMessage, chatMessages, type Allowance, type InsertAllowance, allowances } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

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
  updateBalance(peerId: number, sats: number): Promise<Peer>;
  updatePeerPin(peerId: number, newPin: string): Promise<Peer>;
  updatePeerFamilyName(peerId: number, familyName: string): Promise<Peer>;
  updateChildLightningAddress(peerId: number, lightningAddress: string): Promise<Peer>;
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
      .set({ lnbitsUrl, lnbitsAdminKey })
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
      .where(and(eq(tasks.createdBy, peerId), eq(tasks.connectionId, connectionId)));
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

}

export const storage = new DatabaseStorage();
