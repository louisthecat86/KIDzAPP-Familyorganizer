import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Peers/Users Table
export const peers = pgTable("peers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'parent' or 'child'
  pin: text("pin").notNull().unique(), // Personal PIN for login
  connectionId: text("connection_id").notNull(), // Family ID - auto generated
  balance: integer("balance").default(0).notNull(), // Sats balance
  nwcConnectionString: text("nwc_connection_string"), // NWC URI for wallet connection
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPeerSchema = createInsertSchema(peers).omit({
  id: true,
  createdAt: true,
  balance: true,
});

export type InsertPeer = z.infer<typeof insertPeerSchema>;
export type Peer = typeof peers.$inferSelect;

// Tasks Table
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  connectionId: text("connection_id").notNull(), // Link to family
  createdBy: integer("created_by").notNull(), // Parent ID
  title: text("title").notNull(),
  description: text("description").notNull(),
  sats: integer("sats").notNull(),
  status: text("status").notNull(), // 'open', 'assigned', 'submitted', 'approved'
  assignedTo: integer("assigned_to"), // Peer ID
  proof: text("proof"), // File reference or URL
  paylink: text("paylink"), // LNBits paylink for funding
  withdrawLink: text("withdraw_link"), // LNBits withdraw link for child payout
  escrowLocked: boolean("escrow_locked").default(false).notNull(), // Is payment locked in escrow?
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  escrowLocked: true,
  paylink: true,
  withdrawLink: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Transactions Table (for tracking payments)
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  fromPeerId: integer("from_peer_id").notNull(),
  toPeerId: integer("to_peer_id").notNull(),
  sats: integer("sats").notNull(),
  taskId: integer("task_id"), // Link to task if escrow-related
  type: text("type").notNull(), // 'escrow_lock', 'escrow_release', 'withdrawal'
  paymentHash: text("payment_hash"), // LNBits invoice hash
  status: text("status").notNull(), // 'pending', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
