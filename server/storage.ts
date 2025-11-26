import { db } from "./db";
import { type Peer, type InsertPeer, peers, type Task, type InsertTask, tasks, type Transaction, type InsertTransaction, transactions, type FamilyEvent, type InsertFamilyEvent, familyEvents } from "@shared/schema";
import { eq, and } from "drizzle-orm";

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
  updatePeerNWC(peerId: number, nwcConnectionString: string): Promise<Peer>;
  updateBalance(peerId: number, sats: number): Promise<Peer>;
  
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
    return result[0];
  }

  async getAllParents(): Promise<Peer[]> {
    return await db.select().from(peers).where(eq(peers.role, "parent"));
  }

  async createPeer(insertPeer: InsertPeer): Promise<Peer> {
    const result = await db.insert(peers).values(insertPeer).returning();
    return result[0];
  }

  async linkChildToParent(childId: number, parentConnectionId: string): Promise<Peer> {
    // Get parent name from connectionId
    const parent = await db.select().from(peers)
      .where(and(eq(peers.connectionId, parentConnectionId), eq(peers.role, "parent")))
      .limit(1);
    
    const result = await db.update(peers)
      .set({ 
        connectionId: parentConnectionId,
        familyName: parent[0]?.name // Store parent name as familyName
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

  async updatePeerNWC(peerId: number, nwcConnectionString: string): Promise<Peer> {
    const result = await db.update(peers)
      .set({ nwcConnectionString })
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
    const result = await db.insert(familyEvents).values(insertEvent).returning();
    return result[0];
  }

  async updateEvent(id: number, updates: Partial<FamilyEvent>): Promise<FamilyEvent | undefined> {
    const result = await db.update(familyEvents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(familyEvents.id, id))
      .returning();
    return result[0];
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await db.delete(familyEvents).where(eq(familyEvents.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();
