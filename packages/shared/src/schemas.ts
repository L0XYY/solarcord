import { z } from "zod";

// ── Auth ──
export const signupSchema = z.object({
  email: z.string().email().max(254),
  username: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_.]+$/i, "Letters, numbers, underscore and dot only"),
  displayName: z.string().min(1).max(64).optional(),
  password: z.string().min(8).max(128),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyEmailSchema = z.object({ token: z.string().min(10).max(128) });
export const changeEmailSchema = z.object({ email: z.string().email().max(254) });

// An image reference: an http(s) URL, or an inline data URL from a device upload.
export const imageRef = z
  .string()
  .max(6_000_000)
  .refine((v) => v.startsWith("data:image/") || /^https?:\/\//i.test(v), { message: "Must be an image" });

// ── User profile ──
export const updateMeSchema = z.object({
  displayName: z.string().min(1).max(64).nullable().optional(),
  bio: z.string().max(300).nullable().optional(),
  pronouns: z.string().max(40).nullable().optional(),
  avatarUrl: imageRef.nullable().optional(),
  bannerUrl: imageRef.nullable().optional(),
  customStatus: z.string().max(128).nullable().optional(),
  status: z.enum(["ONLINE", "IDLE", "DND", "INVISIBLE"]).optional(),
  themePrimary: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  themeAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  tag: z.string().max(6).nullable().optional(),
  tagBadge: z.string().max(6_000_000).nullable().optional(),
});

// ── Servers ──
export const createServerSchema = z.object({
  name: z.string().min(2).max(64),
  iconUrl: z.string().url().optional(),
});
export type CreateServerInput = z.infer<typeof createServerSchema>;

export const serverVisibilitySchema = z.enum(["PRIVATE", "PUBLIC", "COMMUNITY", "DISCOVERABLE"]);

export const DISCOVERY_CATEGORIES = [
  "Gaming",
  "Music",
  "Education",
  "Anime",
  "Coding",
  "Roblox",
  "Minecraft",
  "Creators",
  "Esports",
  "Tech",
  "Art",
] as const;

export const updateServerSchema = z.object({
  name: z.string().min(2).max(64).optional(),
  description: z.string().max(512).nullable().optional(),
  iconUrl: imageRef.nullable().optional(),
  bannerUrl: imageRef.nullable().optional(),
  tag: z.string().max(6).nullable().optional(),
  tagBadge: z.string().max(6_000_000).nullable().optional(),
  visibility: serverVisibilitySchema.optional(),
  category: z.string().max(32).nullable().optional(),
  systemChannelId: z.string().nullable().optional(),
  announceJoins: z.boolean().optional(),
  announceBoosts: z.boolean().optional(),
});

// ── Server boosts ──
export const BANNER_BOOST_REQUIREMENT = 7;
export const BOOST_TIERS = [
  { level: 1, required: 2, perk: "More emoji slots & better audio" },
  { level: 2, required: 7, perk: "Server banner & 1080p streams" },
  { level: 3, required: 14, perk: "Animated icon, vanity URL & max uploads" },
] as const;

export function boostLevelFor(count: number): number {
  if (count >= 14) return 3;
  if (count >= 7) return 2;
  if (count >= 2) return 1;
  return 0;
}

export const discoveryQuery = z.object({
  q: z.string().max(64).optional(),
  category: z.string().max(32).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

// ── Channels ──
export const channelTypeSchema = z.enum([
  "TEXT",
  "VOICE",
  "VIDEO",
  "ANNOUNCEMENT",
  "STAGE",
  "FORUM",
  "MEDIA",
  "RULES",
]);

export const createChannelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[^\s#@]+$/i, "No spaces or # @ characters"),
  type: channelTypeSchema.default("TEXT"),
  topic: z.string().max(1024).optional(),
});
export type CreateChannelInput = z.infer<typeof createChannelSchema>;

// ── Messages ──
export const createMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  replyToId: z.string().optional(),
});
export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const messageHistoryQuery = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const editMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

// A reaction emoji: a unicode emoji, or a custom emoji ref like :name:id.
export const reactionEmojiSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[^\s]+$/, "Invalid emoji");

// ── Roles ──
// Permission bitfields travel as decimal strings (BigInt range).
const permissionBits = z.string().regex(/^\d+$/, "Invalid permission bits").max(40);

export const createRoleSchema = z.object({
  name: z.string().min(1).max(32),
  color: z.number().int().min(0).max(0xffffff).optional(),
  permissions: permissionBits.optional(),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(32).optional(),
  color: z.number().int().min(0).max(0xffffff).optional(),
  permissions: permissionBits.optional(),
  iconUrl: imageRef.nullable().optional(),
  hoisted: z.boolean().optional(),
  mentionable: z.boolean().optional(),
});

export const moveRoleSchema = z.object({ direction: z.enum(["up", "down"]) });
export const reorderRolesSchema = z.object({ orderedIds: z.array(z.string()).max(250) });

// ── Custom user badges (admin) ──
export const createUserBadgeSchema = z.object({
  key: z.string().min(2).max(40).regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, underscore"),
  name: z.string().min(2).max(48),
  description: z.string().max(160).optional(),
  iconUrl: imageRef.optional(),
});

export const updateUserBadgeSchema = z.object({
  name: z.string().min(2).max(48).optional(),
  description: z.string().max(160).optional(),
  iconUrl: imageRef.nullable().optional(),
});

export const grantBadgeSchema = z.object({
  username: z.string().min(2).max(32),
});

// ── Friends ──
export const sendFriendRequestSchema = z.object({
  username: z.string().min(2).max(32),
});

// ── DMs ──
export const createDMSchema = z.object({
  // 1 user → 1:1 DM; 2+ → group DM.
  userIds: z.array(z.string()).min(1).max(9),
  name: z.string().min(1).max(64).optional(),
});
export type CreateDMInput = z.infer<typeof createDMSchema>;

// ── Developer / bots ──
export const createBotAppSchema = z.object({
  name: z.string().min(2).max(32),
  description: z.string().max(300).optional(),
});

export const addBotSchema = z.object({
  applicationId: z.string(),
});

// ── Reports ──
export const createReportSchema = z.object({
  targetType: z.enum(["message", "user", "server"]),
  targetId: z.string(),
  reason: z.string().min(3).max(1000),
});

export const resolveReportSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
});

// ── Webhooks ──
export const createWebhookSchema = z.object({
  name: z.string().min(1).max(64),
  avatarUrl: z.string().url().optional(),
});

// Body posted to a webhook's execute URL (public).
export const executeWebhookSchema = z.object({
  content: z.string().min(1).max(4000),
  username: z.string().min(1).max(64).optional(),
  avatarUrl: z.string().url().optional(),
});

// ── AutoMod ──
export const updateAutoModSchema = z.object({
  bannedWords: z.array(z.string().min(1).max(64)).max(200),
});

// ── Badges & admin ──
export const serverBadgeTypeSchema = z.enum([
  "COMMUNITY",
  "DISCOVERABLE",
  "SOLAR_PARTNER",
  "VERIFIED",
  "OFFICIAL_CREATOR",
  "OFFICIAL_BRAND",
  "STAFF_PICK",
  "BOOSTED",
  "SAFE_COMMUNITY",
]);

// Badges a server owner may apply for (the rest are granted automatically or by staff only).
export const applicableBadgeSchema = z.enum(["VERIFIED", "SOLAR_PARTNER", "SAFE_COMMUNITY"]);

export const createBadgeApplicationSchema = z.object({
  type: applicableBadgeSchema,
  reason: z.string().min(10).max(1000),
});

export const reviewBadgeApplicationSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().max(500).optional(),
});

export const verifyServerSchema = z.object({
  isVerified: z.boolean().optional(),
  isPartnered: z.boolean().optional(),
});

export const setStandingSchema = z.object({
  standing: z.enum(["ALL_GOOD", "LIMITED", "VERY_LIMITED", "AT_RISK", "SUSPENDED"]),
  reason: z.string().max(512).optional(),
});

export const adminListQuery = z.object({
  q: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ── Moderation ──
export const banSchema = z.object({
  userId: z.string(),
  reason: z.string().max(512).optional(),
  deleteMessageDays: z.number().int().min(0).max(7).optional(),
});

export const timeoutSchema = z.object({
  // minutes; 0 clears the timeout
  minutes: z.number().int().min(0).max(60 * 24 * 28),
});

export const auditLogQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().optional(),
});

export const warnSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const modNoteSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const updateGuideSchema = z.object({
  rules: z.array(z.string().min(1).max(500)).max(50).optional(),
  welcomeMessage: z.string().max(1000).nullable().optional(),
});

// ── Invites ──
export const createInviteSchema = z.object({
  maxUses: z.number().int().min(0).max(1000).optional(), // 0 / undefined = unlimited
  expiresInHours: z.number().int().min(0).max(24 * 30).optional(), // 0 / undefined = never
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
