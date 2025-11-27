import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Peers/Users Table
export const peers = pgTable("peers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'parent' or 'child'
  pin: text("pin").notNull(), // Personal PIN for login (unique per name)
  connectionId: text("connection_id").notNull(), // Family ID - auto generated
  familyName: text("family_name"), // Family name (set by parent on registration)
  balance: integer("balance").default(0).notNull(), // Sats balance
  nwcConnectionString: text("nwc_connection_string"), // NWC: nostr+walletconnect://... (parent for escrow)
  lnbitsUrl: text("lnbits_url"), // LNBits instance URL (parent)
  lnbitsAdminKey: text("lnbits_admin_key"), // LNBits admin key (parent)
  lightningAddress: text("lightning_address"), // Lightning address for child (receives sats directly)
  securityQuestion: text("security_question"), // Security question for parent PIN recovery
  securityAnswer: text("security_answer"), // Hashed answer to security question
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueNamePin: sql`unique (name, pin)`,
}));

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
  paymentHash: text("payment_hash"), // Payment hash from lightning payment
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

// Family Events/Appointments Table
export const familyEvents = pgTable("family_events", {
  id: serial("id").primaryKey(),
  connectionId: text("connection_id").notNull(), // Family ID
  createdBy: integer("created_by").notNull(), // Parent ID
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  location: text("location"),
  color: text("color").default("primary"), // Event color for calendar
  eventType: text("event_type").default("appointment"), // 'appointment', 'birthday', 'holiday', 'reminder'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFamilyEventSchema = createInsertSchema(familyEvents)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    endDate: z.union([z.string(), z.date()]).optional(),
    startDate: z.union([z.string(), z.date()]),
  });

export type InsertFamilyEvent = z.infer<typeof insertFamilyEventSchema>;
export type FamilyEvent = typeof familyEvents.$inferSelect;

// Event RSVPs Table
export const eventRsvps = pgTable("event_rsvps", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  peerId: integer("peer_id").notNull(),
  response: text("response").notNull(), // 'accepted', 'declined', 'pending'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEventRsvpSchema = createInsertSchema(eventRsvps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEventRsvp = z.infer<typeof insertEventRsvpSchema>;

// Family Chat Messages Table
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  connectionId: text("connection_id").notNull(), // Family ID
  fromPeerId: integer("from_peer_id").notNull(), // Sender ID
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type EventRsvp = typeof eventRsvps.$inferSelect;
