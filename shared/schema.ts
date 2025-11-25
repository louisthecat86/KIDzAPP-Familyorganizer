import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Peers/Users Table
export const peers = pgTable("peers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'parent' or 'child'
  pin: text("pin").notNull().unique(), // Personal PIN for login
  connectionId: text("connection_id").notNull(), // Family ID
  pairedWithPin: text("paired_with_pin"), // PIN used to join family (null if parent/founder)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPeerSchema = createInsertSchema(peers).omit({
  id: true,
  createdAt: true,
});

export type InsertPeer = z.infer<typeof insertPeerSchema>;
export type Peer = typeof peers.$inferSelect;

// Tasks Table
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  connectionId: text("connection_id").notNull(), // Link to family
  title: text("title").notNull(),
  description: text("description").notNull(),
  sats: integer("sats").notNull(),
  status: text("status").notNull(), // 'open', 'assigned', 'submitted', 'approved'
  assignedTo: integer("assigned_to"), // Peer ID
  proof: text("proof"), // File reference or URL
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
