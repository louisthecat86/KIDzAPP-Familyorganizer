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
  lnbitsUrl: text("lnbits_url"), // LNBits instance URL (parent)
  lnbitsAdminKey: text("lnbits_admin_key"), // LNBits admin key (parent)
  nwcConnectionString: text("nwc_connection_string"), // Nostr Wallet Connect connection string (parent)
  walletType: text("wallet_type"), // 'lnbits' or 'nwc' - which wallet to use for payments
  lightningAddress: text("lightning_address"), // Lightning address for child (receives sats directly)
  donationAddress: text("donation_address"), // Lightning address for parent donations
  favoriteColor: text("favorite_color"), // Favorite color for PIN recovery
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueNamePin: sql`unique (name, pin)`,
}));

export const insertPeerSchema = createInsertSchema(peers).omit({
  id: true,
  createdAt: true,
  balance: true,
}).extend({
  securityQuestion: z.string().optional(),
  securityAnswer: z.string().optional(),
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
  isRequired: boolean("is_required").default(false).notNull(), // Pflicht-Aufgabe (nicht bezahlt) vs bezahlte Aufgabe
  minimumRequiredTasks: integer("minimum_required_tasks").default(0).notNull(), // Wieviele Pflicht-Tasks müssen erst erledigt sein
  bypassRatio: boolean("bypass_ratio").default(false).notNull(), // Sofort freischalten (ignore 3:1 ratio)
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

// Allowances (Taschengeld) Table
export const allowances = pgTable("allowances", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id").notNull(), // Parent ID
  childId: integer("child_id").notNull(), // Child ID
  connectionId: text("connection_id").notNull(), // Family ID
  sats: integer("sats").notNull(), // Amount in sats
  frequency: text("frequency").notNull(), // 'daily', 'weekly', 'biweekly', 'monthly'
  lastPaidDate: timestamp("last_paid_date"), // Last payment date
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAllowanceSchema = createInsertSchema(allowances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastPaidDate: true,
});

export type InsertAllowance = z.infer<typeof insertAllowanceSchema>;
export type Allowance = typeof allowances.$inferSelect;

// Daily Bitcoin Snapshots (for tracking savings value over time)
export const dailyBitcoinSnapshots = pgTable("daily_bitcoin_snapshots", {
  id: serial("id").primaryKey(),
  peerId: integer("peer_id").notNull(), // Child ID
  connectionId: text("connection_id").notNull(), // Family ID
  valueEur: integer("value_eur").notNull(), // Value in cents (to avoid decimals)
  satoshiAmount: integer("satoshi_amount").notNull(), // Sats at time of snapshot
  btcPrice: integer("btc_price").notNull().default(0), // BTC price in cents at time of snapshot (EUR)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDailyBitcoinSnapshotSchema = createInsertSchema(dailyBitcoinSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertDailyBitcoinSnapshot = z.infer<typeof insertDailyBitcoinSnapshotSchema>;
export type DailyBitcoinSnapshot = typeof dailyBitcoinSnapshots.$inferSelect;

// Monthly Savings Account Snapshots (for tracking savings account with interest)
export const monthlySavingsSnapshots = pgTable("monthly_savings_snapshots", {
  id: serial("id").primaryKey(),
  peerId: integer("peer_id").notNull(), // Child ID
  connectionId: text("connection_id").notNull(), // Family ID
  valueEur: integer("value_eur").notNull(), // Value in cents including interest
  satoshiAmount: integer("satoshi_amount").notNull(), // Sats at time of snapshot
  interestEarned: integer("interest_earned").notNull(), // Interest in cents earned that month
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMonthlySavingsSnapshotSchema = createInsertSchema(monthlySavingsSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertMonthlySavingsSnapshot = z.infer<typeof insertMonthlySavingsSnapshotSchema>;
export type MonthlySavingsSnapshot = typeof monthlySavingsSnapshots.$inferSelect;

// Level Bonus Settings (per family - set by parent)
export const levelBonusSettings = pgTable("level_bonus_settings", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id").notNull(), // Parent who set this
  connectionId: text("connection_id").notNull(), // Family ID
  bonusSats: integer("bonus_sats").notNull().default(210), // Amount of sats for bonus
  milestoneInterval: integer("milestone_interval").notNull().default(5), // Every X levels
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLevelBonusSettingsSchema = createInsertSchema(levelBonusSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLevelBonusSettings = z.infer<typeof insertLevelBonusSettingsSchema>;
export type LevelBonusSettings = typeof levelBonusSettings.$inferSelect;

// Level Bonus Payouts (tracks which bonuses have been paid out)
export const levelBonusPayouts = pgTable("level_bonus_payouts", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(), // Child who received bonus
  connectionId: text("connection_id").notNull(), // Family ID
  level: integer("level").notNull(), // Level that triggered the bonus
  sats: integer("sats").notNull(), // Amount paid
  paidAt: timestamp("paid_at").defaultNow().notNull(),
});

export const insertLevelBonusPayoutSchema = createInsertSchema(levelBonusPayouts).omit({
  id: true,
  paidAt: true,
});

export type InsertLevelBonusPayout = z.infer<typeof insertLevelBonusPayoutSchema>;
export type LevelBonusPayout = typeof levelBonusPayouts.$inferSelect;

// Recurring Tasks Table
export const recurringTasks = pgTable("recurring_tasks", {
  id: serial("id").primaryKey(),
  connectionId: text("connection_id").notNull(), // Family ID
  createdBy: integer("created_by").notNull(), // Parent ID
  title: text("title").notNull(),
  description: text("description").notNull(),
  sats: integer("sats").notNull(),
  frequency: text("frequency").notNull(), // 'daily', 'weekly', 'biweekly', 'monthly'
  dayOfWeek: integer("day_of_week"), // 0-6 (Sunday-Saturday) for weekly tasks
  dayOfMonth: integer("day_of_month"), // 1-31 for monthly tasks
  time: text("time").default("09:00").notNull(), // HH:mm format (24-hour)
  isActive: boolean("is_active").default(true).notNull(),
  lastCreatedDate: timestamp("last_created_date"), // Track when last task was created
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRecurringTaskSchema = createInsertSchema(recurringTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastCreatedDate: true,
});

export type InsertRecurringTask = z.infer<typeof insertRecurringTaskSchema>;
export type RecurringTask = typeof recurringTasks.$inferSelect;

// Learning Progress Table (for Bitcoin Education gamification)
export const learningProgress = pgTable("learning_progress", {
  id: serial("id").primaryKey(),
  peerId: integer("peer_id").notNull(), // Child who is learning
  xp: integer("xp").default(0).notNull(), // Experience points
  level: integer("level").default(1).notNull(), // Current level (1-10)
  streak: integer("streak").default(0).notNull(), // Current streak in days
  longestStreak: integer("longest_streak").default(0).notNull(), // Best streak ever
  lastActivityDate: timestamp("last_activity_date"), // For streak tracking
  completedModules: text("completed_modules").array().default([]).notNull(), // Array of module IDs
  unlockedAchievements: text("unlocked_achievements").array().default([]).notNull(), // Array of achievement IDs
  totalQuizzesPassed: integer("total_quizzes_passed").default(0).notNull(),
  totalSatsEarned: integer("total_sats_earned").default(0).notNull(),
  dailyChallengesCompleted: integer("daily_challenges_completed").default(0).notNull(),
  graduatedAt: timestamp("graduated_at"), // When child completed all learning content
  guardianLevel: integer("guardian_level").default(0).notNull(), // 0=not graduated, 1=Guardian, 2=Ambassador, 3=Master
  masteryStreakCount: integer("mastery_streak_count").default(0).notNull(), // Post-graduation mastery refresher completions
  graduationBonusClaimed: boolean("graduation_bonus_claimed").default(false).notNull(), // Whether graduation sats bonus was claimed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLearningProgressSchema = createInsertSchema(learningProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLearningProgress = z.infer<typeof insertLearningProgressSchema>;
export type LearningProgress = typeof learningProgress.$inferSelect;

// Daily Challenges Table (for tracking daily challenge completion)
export const dailyChallenges = pgTable("daily_challenges", {
  id: serial("id").primaryKey(),
  peerId: integer("peer_id").notNull(), // Child who is taking challenge
  challengeDate: text("challenge_date").notNull(), // Date string (YYYY-MM-DD)
  challengeType: text("challenge_type").notNull(), // 'quiz', 'conversion', 'lightning', 'security', 'fun', 'blockchain'
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDailyChallengeSchema = createInsertSchema(dailyChallenges).omit({
  id: true,
  createdAt: true,
});

export type InsertDailyChallenge = z.infer<typeof insertDailyChallengeSchema>;
export type DailyChallenge = typeof dailyChallenges.$inferSelect;

// Shopping List Table (Einkaufsliste - shared family list)
export const shoppingList = pgTable("shopping_list", {
  id: serial("id").primaryKey(),
  connectionId: text("connection_id").notNull(), // Family ID
  createdBy: integer("created_by").notNull(), // Peer ID who added this
  item: text("item").notNull(), // Item description (e.g. "Milk", "Bread")
  quantity: text("quantity"), // Optional quantity (e.g. "2", "1 liter")
  completed: boolean("completed").default(false).notNull(), // Mark as bought
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertShoppingListSchema = createInsertSchema(shoppingList).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertShoppingList = z.infer<typeof insertShoppingListSchema>;
export type ShoppingList = typeof shoppingList.$inferSelect;

// Push Subscriptions Table (for web push notifications)
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  peerId: integer("peer_id").notNull(), // User who subscribed
  connectionId: text("connection_id").notNull(), // Family ID
  endpoint: text("endpoint").notNull(), // Push service endpoint URL
  p256dh: text("p256dh").notNull(), // Public key for encryption
  auth: text("auth").notNull(), // Auth secret for encryption
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
