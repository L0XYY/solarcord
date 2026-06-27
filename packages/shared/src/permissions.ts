// Permission bitfield — shared source of truth for client and server.
// Stored as a string in the DB (BigInt range). Compute with the helpers below.

export const Permission = {
  // General
  VIEW_CHANNEL: 1n << 0n,
  MANAGE_CHANNELS: 1n << 1n,
  MANAGE_SERVER: 1n << 2n,
  MANAGE_ROLES: 1n << 3n,
  VIEW_AUDIT_LOG: 1n << 4n,
  ADMINISTRATOR: 1n << 5n,

  // Membership / moderation
  CREATE_INVITE: 1n << 6n,
  KICK_MEMBERS: 1n << 7n,
  BAN_MEMBERS: 1n << 8n,
  TIMEOUT_MEMBERS: 1n << 9n,

  // Messaging
  SEND_MESSAGES: 1n << 10n,
  READ_HISTORY: 1n << 11n,
  MANAGE_MESSAGES: 1n << 12n,
  EMBED_LINKS: 1n << 13n,
  ATTACH_FILES: 1n << 14n,
  ADD_REACTIONS: 1n << 15n,
  MENTION_EVERYONE: 1n << 16n,
  MANAGE_WEBHOOKS: 1n << 17n,
  MANAGE_EMOJIS: 1n << 18n,

  // Threads
  CREATE_PUBLIC_THREADS: 1n << 19n,
  CREATE_PRIVATE_THREADS: 1n << 20n,
  SEND_IN_THREADS: 1n << 21n,

  // Voice
  CONNECT: 1n << 22n,
  SPEAK: 1n << 23n,
  STREAM: 1n << 24n,
  MUTE_MEMBERS: 1n << 25n,
  DEAFEN_MEMBERS: 1n << 26n,
  MOVE_MEMBERS: 1n << 27n,

  // Events / stage
  MANAGE_EVENTS: 1n << 28n,
  STAGE_MODERATOR: 1n << 29n,
} as const;

export type PermissionKey = keyof typeof Permission;

// A sensible default for the @everyone role on a new server.
export const DEFAULT_EVERYONE_PERMISSIONS =
  Permission.VIEW_CHANNEL |
  Permission.SEND_MESSAGES |
  Permission.READ_HISTORY |
  Permission.EMBED_LINKS |
  Permission.ATTACH_FILES |
  Permission.ADD_REACTIONS |
  Permission.CREATE_INVITE |
  Permission.CONNECT |
  Permission.SPEAK |
  Permission.STREAM |
  Permission.CREATE_PUBLIC_THREADS |
  Permission.SEND_IN_THREADS;

// UI metadata: human labels + descriptions, grouped for the roles dashboard.
export interface PermissionInfo {
  key: PermissionKey;
  label: string;
  description: string;
}

export const PERMISSION_GROUPS: { group: string; permissions: PermissionInfo[] }[] = [
  {
    group: "General",
    permissions: [
      { key: "VIEW_CHANNEL", label: "View Channels", description: "See channels in the server by default." },
      { key: "MANAGE_CHANNELS", label: "Manage Channels", description: "Create, edit and delete channels." },
      { key: "MANAGE_SERVER", label: "Manage Server", description: "Change the server name, icon and settings." },
      { key: "MANAGE_ROLES", label: "Manage Roles", description: "Create and edit roles below their highest role." },
      { key: "VIEW_AUDIT_LOG", label: "View Audit Log", description: "See a record of moderation actions." },
      { key: "ADMINISTRATOR", label: "Administrator", description: "All permissions, bypassing channel overrides. Dangerous." },
    ],
  },
  {
    group: "Membership",
    permissions: [
      { key: "CREATE_INVITE", label: "Create Invite", description: "Invite new people to the server." },
      { key: "KICK_MEMBERS", label: "Kick Members", description: "Remove members from the server." },
      { key: "BAN_MEMBERS", label: "Ban Members", description: "Permanently ban members." },
      { key: "TIMEOUT_MEMBERS", label: "Timeout Members", description: "Temporarily mute members." },
    ],
  },
  {
    group: "Messages",
    permissions: [
      { key: "SEND_MESSAGES", label: "Send Messages", description: "Post messages in text channels." },
      { key: "READ_HISTORY", label: "Read History", description: "Read previously sent messages." },
      { key: "MANAGE_MESSAGES", label: "Manage Messages", description: "Delete and pin others' messages." },
      { key: "EMBED_LINKS", label: "Embed Links", description: "Links posted show a preview embed." },
      { key: "ATTACH_FILES", label: "Attach Files", description: "Upload images and files." },
      { key: "ADD_REACTIONS", label: "Add Reactions", description: "React to messages with emoji." },
      { key: "MENTION_EVERYONE", label: "Mention Everyone", description: "Use @everyone and @here." },
      { key: "MANAGE_EMOJIS", label: "Manage Emojis", description: "Add and remove custom emojis." },
    ],
  },
  {
    group: "Voice",
    permissions: [
      { key: "CONNECT", label: "Connect", description: "Join voice channels." },
      { key: "SPEAK", label: "Speak", description: "Talk in voice channels." },
      { key: "STREAM", label: "Video / Stream", description: "Share video and screen." },
      { key: "MUTE_MEMBERS", label: "Mute Members", description: "Mute others in voice." },
      { key: "DEAFEN_MEMBERS", label: "Deafen Members", description: "Deafen others in voice." },
      { key: "MOVE_MEMBERS", label: "Move Members", description: "Move members between voice channels." },
    ],
  },
];

export function toBits(value: string | bigint): bigint {
  return typeof value === "bigint" ? value : BigInt(value || "0");
}

export function has(bits: string | bigint, perm: bigint): boolean {
  const b = toBits(bits);
  if (b & Permission.ADMINISTRATOR) return true;
  return (b & perm) === perm;
}

/** Combine multiple role permission strings into one bitfield string. */
export function combine(...values: (string | bigint)[]): string {
  let acc = 0n;
  for (const v of values) acc |= toBits(v);
  return acc.toString();
}

/**
 * Apply channel overrides (everyone → roles → member) onto a base bitfield.
 * Each override is { allow, deny } as strings.
 */
export function applyOverrides(
  base: string | bigint,
  overrides: { allow: string; deny: string }[],
): string {
  let bits = toBits(base);
  for (const o of overrides) {
    bits &= ~toBits(o.deny);
    bits |= toBits(o.allow);
  }
  return bits.toString();
}
