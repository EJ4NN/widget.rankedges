import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  numeric,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import type { LeaderboardColumns } from "@/lib/leaderboard-columns"

/* --------------------------- Metric snapshots --------------------------- */

// The two live-data providers a participant's metrics can come from.
export type SourceKey = "aimsranking" | "metaapi"

// A full set of metrics captured from ONE source at sync time. We keep one of
// these per source on each participant so the admin can flip the displayed
// source instantly (we just re-project the chosen snapshot into the flat metric
// columns the leaderboard reads) without re-hitting any API.
export type MetricSnapshot = {
  currentBalance: number
  currentEquity: number
  profit: number
  profitPct: number
  gain: number
  absoluteGain: number
  rankEdgesGain: number
  lots: number
  maxDrawdown: number
  deposits: number
  withdrawals: number
  trades: number | null
  winRate: number
  syncedAt: string // ISO timestamp of when this source was last synced
}

export type SourceSnapshots = Partial<Record<SourceKey, MetricSnapshot>>

/* ----------------------------- Better Auth ----------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  image: text("image"),
  // Admin tier: "master" has full access (all contests, servers, branding,
  // admins) and can assign contests; "admin" (sub-admin) can only manage
  // contests they own or that a master assigned to them.
  role: text("role").default("admin").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
})

/* ------------------------------ App tables ------------------------------ */

// Global site branding, editable by admins. Single row (id = 1).
export const setting = pgTable("setting", {
  id: integer("id").primaryKey().default(1),
  logoUrl: text("logoUrl"), // overrides the default RankEdges crest
  coBrandUrl: text("coBrandUrl"), // optional partner logo shown alongside (e.g. AIMS)
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
})

// Admin-configured MT4/MT5 servers that clients pick from when joining.
export const brokerServer = pgTable("broker_server", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // "mt4" | "mt5"
  company: text("company"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
})

export const contest = pgTable("contest", {
  id: serial("id").primaryKey(),
  // Sub-admin who created/owns this contest (user.id). Null for legacy rows,
  // which are treated as master-owned. Not a hard FK to keep migrations simple;
  // when an owner is deleted we transfer ownership to master.
  ownerId: text("ownerId"),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  rules: text("rules"),
  // Frequently asked questions, stored as alternating "Q:"/"A:" line pairs
  // (same free-text approach as `rules`). Parsed into an accordion for display.
  faq: text("faq"),
  prizePool: text("prizePool"),
  startingBalance: numeric("startingBalance", { precision: 18, scale: 2 })
    .default("10000")
    .notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  // IANA timezone (e.g. "Asia/Singapore") the dates were entered in, captured
  // from the admin's browser on save. Public dates are displayed in this zone
  // so everyone sees the same wall-clock dates the organizer intended.
  timeZone: text("timeZone"),
  status: text("status").default("upcoming").notNull(), // upcoming | live | ended
  // Where live metrics are pulled from: "metaapi" (per-account provisioning) or
  // "aimsranking" (bulk contestant records from the AIMSCAP Ranking API).
  dataSource: text("dataSource").default("metaapi").notNull(),
  // Ranking metric for contests WITHOUT batches (batched contests rank by each
  // batch's own winnerType). "gain" | "absoluteGain" | "rankEdgesGain" | "lots".
  // AIMS RankEdges contests should use "rankEdgesGain".
  winnerType: text("winnerType").default("gain").notNull(),
  // Which stored source snapshot is shown on the leaderboard / admin table.
  // "aimsranking" | "metaapi". When null, falls back to `dataSource`. Toggling
  // this only re-projects existing snapshots — it never calls an external API.
  displaySource: text("displaySource"),
  // When true, entrants must provide an email address to join this contest.
  requireEmail: boolean("requireEmail").default(false).notNull(),
  maxParticipants: integer("maxParticipants"),
  posterUrl: text("posterUrl"), // wide banner shown on the contest page
  thumbnailUrl: text("thumbnailUrl"), // square-ish card image on listings
  sponsorLogoUrl: text("sponsorLogoUrl"), // per-contest sponsor, co-branded with RankEdges in the header
  // Broker companies allowed to join (matches brokerServer.company). Empty/null = all allowed.
  allowedBrokers: jsonb("allowedBrokers").$type<string[]>(),
  // Admin-controlled visibility of leaderboard columns/fields.
  leaderboardColumns: jsonb("leaderboardColumns").$type<LeaderboardColumns>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
})

// A contest can run in sequential rounds ("batches"), each with its own date
// range, prize pool, and winning metric. Contests with no batches behave as a
// single round (backward compatible).
export const batch = pgTable("batch", {
  id: serial("id").primaryKey(),
  contestId: integer("contestId").notNull(),
  name: text("name").notNull(), // e.g. "June Batch", "Batch 1"
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  prizePool: text("prizePool"),
  winnerType: text("winnerType").default("gain").notNull(), // gain | absoluteGain | rankEdgesGain | lots
  advanceCount: integer("advanceCount").default(0).notNull(), // top N advance to next round (0 = none)
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
})

export const participant = pgTable("participant", {
  id: serial("id").primaryKey(),
  contestId: integer("contestId").notNull(),
  batchId: integer("batchId"), // nullable: which round this trader belongs to
  nickname: text("nickname").notNull(),
  realName: text("realName").notNull(), // private, admin only
  email: text("email"),
  platform: text("platform").notNull(), // "mt4" | "mt5"
  // Per-participant data source override: "metaapi" | "aimsranking". When null,
  // the participant inherits the contest's dataSource. Lets an admin pull a
  // specific trader from the AIMS Ranking feed even in a MetaAPI contest (e.g.
  // when MetaAPI account slots are full or credentials can't be provisioned).
  dataSource: text("dataSource"),
  serverId: integer("serverId"),
  serverName: text("serverName"),
  accountLogin: text("accountLogin").notNull(),
  investorPassword: text("investorPassword").notNull(),
  metaApiAccountId: text("metaApiAccountId"),
  status: text("status").default("pending").notNull(), // pending | active | rejected | disqualified
  startingBalance: numeric("startingBalance", { precision: 18, scale: 2 }),
  currentBalance: numeric("currentBalance", { precision: 18, scale: 2 }),
  currentEquity: numeric("currentEquity", { precision: 18, scale: 2 }),
  profit: numeric("profit", { precision: 18, scale: 2 }).default("0"),
  profitPct: numeric("profitPct", { precision: 10, scale: 4 }).default("0"),
  // MetaStats-derived metrics
  gain: numeric("gain", { precision: 12, scale: 4 }).default("0"), // % return (time-weighted)
  absoluteGain: numeric("absoluteGain", { precision: 12, scale: 4 }).default("0"), // % absolute gain
  // RankEdges gain = profit / deposit * 100 (withdrawals excluded). Computed by us
  // for every data source, distinct from the broker/AIMS-reported gain figures.
  rankEdgesGain: numeric("rankEdgesGain", { precision: 12, scale: 4 }).default("0"),
  lots: numeric("lots", { precision: 18, scale: 2 }).default("0"), // total traded volume
  maxDrawdown: numeric("maxDrawdown", { precision: 10, scale: 4 }).default("0"),
  deposits: numeric("deposits", { precision: 18, scale: 2 }).default("0"),
  withdrawals: numeric("withdrawals", { precision: 18, scale: 2 }).default("0"),
  trades: integer("trades").default(0),
  winRate: numeric("winRate", { precision: 10, scale: 4 }).default("0"),
  // Per-source metric snapshots (aimsranking + metaapi). The flat metric columns
  // above always mirror the contest's displaySource snapshot; this holds ALL
  // sources so the admin can toggle the display instantly.
  sourceSnapshots: jsonb("sourceSnapshots").$type<SourceSnapshots>(),
  // Auto-generated trader avatar/logo (deterministic per nickname; admin can override)
  avatarUrl: text("avatarUrl"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
})

// Grants a sub-admin management access to a contest they don't own. Master
// creates/removes these. Unique on (contestId, userId) to avoid duplicates.
export const contestAssignment = pgTable(
  "contestAssignment",
  {
    id: serial("id").primaryKey(),
    contestId: integer("contestId").notNull(),
    userId: text("userId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("contestAssignment_contest_user_uniq").on(t.contestId, t.userId),
  }),
)

export type User = typeof user.$inferSelect
export type ContestAssignment = typeof contestAssignment.$inferSelect
export type Contest = typeof contest.$inferSelect
export type Participant = typeof participant.$inferSelect
export type BrokerServer = typeof brokerServer.$inferSelect
export type Batch = typeof batch.$inferSelect
export type Setting = typeof setting.$inferSelect
