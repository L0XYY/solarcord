import type { PublicUser, MessageDTO } from "@solarcord/shared";

// Allow-list mappers: never spread raw Prisma rows into responses (they carry secrets).

export function toPublicUser(u: {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
}): PublicUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    status: u.status as PublicUser["status"],
  };
}

interface ReactionRow {
  emoji: string;
  userId: string;
}

interface MessageRow {
  id: string;
  channelId: string;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  replyToId: string | null;
  author: Parameters<typeof toPublicUser>[0];
  reactions?: ReactionRow[];
  webhookName?: string | null;
  webhookAvatar?: string | null;
  replyTo?: {
    id: string;
    content: string;
    author: { id: string; username: string; displayName: string | null };
  } | null;
}

/** Collapse flat reaction rows into grouped { emoji, userIds }. */
function groupReactions(rows: ReactionRow[] = []): MessageDTO["reactions"] {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.emoji) ?? [];
    list.push(r.userId);
    map.set(r.emoji, list);
  }
  return [...map.entries()].map(([emoji, userIds]) => ({ emoji, userIds }));
}

export function toMessageDTO(m: MessageRow): MessageDTO {
  // Webhook messages display a custom name/avatar instead of the backing user.
  const isWebhook = !!m.webhookName;
  const author = isWebhook
    ? {
        id: `webhook:${m.id}`,
        username: m.webhookName!,
        displayName: m.webhookName!,
        avatarUrl: m.webhookAvatar ?? null,
        status: "ONLINE" as const,
      }
    : toPublicUser(m.author);

  return {
    id: m.id,
    channelId: m.channelId,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    replyToId: m.replyToId,
    replyTo: m.replyTo
      ? { id: m.replyTo.id, content: m.replyTo.content, author: m.replyTo.author }
      : null,
    author,
    reactions: groupReactions(m.reactions),
    isWebhook,
  };
}

export function toSelfUser(u: {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  pronouns: string | null;
  status: string;
  customStatus: string | null;
  themePrimary: string | null;
  themeAccent: string | null;
  isStaff: boolean;
}) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    bannerUrl: u.bannerUrl,
    bio: u.bio,
    pronouns: u.pronouns,
    status: u.status,
    customStatus: u.customStatus,
    themePrimary: u.themePrimary,
    themeAccent: u.themeAccent,
    isStaff: u.isStaff,
  };
}
