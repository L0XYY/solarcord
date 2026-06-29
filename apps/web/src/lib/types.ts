export interface ServerSummary {
  id: string;
  name: string;
  iconUrl: string | null;
  memberCount?: number;
  tag?: string | null;
  tagBadge?: string | null;
}

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: string;
  topic: string | null;
  position: number;
}

export interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  iconUrl: string | null;
  isEveryone: boolean;
  isHoisted: boolean;
  mentionable: boolean;
}

export interface ServerDetail {
  id: string;
  name: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  ownerId: string;
  tag: string | null;
  tagBadge: string | null;
  boostCount: number;
  boostLevel: number;
  channels: Channel[];
  roles: Role[];
  me: { isOwner: boolean; permissions: string };
}

export interface BanEntry {
  user: PublicUserC;
  reason: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor: PublicUserC;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface MemberView {
  id: string;
  nickname: string | null;
  roleIds?: string[];
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    status: string;
    customStatus?: string | null;
    isBot?: boolean;
    tag?: string | null;
    tagBadge?: string | null;
  };
}

export interface PublicUserC {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  tag?: string | null;
  tagBadge?: string | null;
}

export interface FriendRequestC {
  id: string;
  user: PublicUserC;
}

export interface FriendsData {
  friends: PublicUserC[];
  incoming: FriendRequestC[];
  outgoing: FriendRequestC[];
}

export interface DiscoveryServer {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  category: string | null;
  memberCount: number;
  tag: string | null;
  tagBadge: string | null;
  badges: string[];
}

export interface ConversationSummary {
  id: string;
  isGroup: boolean;
  name: string | null;
  iconUrl: string | null;
  participants: PublicUserC[];
  lastMessage: { content: string; createdAt: string } | null;
}

export interface ReactionGroup {
  emoji: string;
  userIds: string[];
}

export interface ReplyPreview {
  id: string;
  content: string;
  author: { id: string; username: string; displayName: string | null };
}

export interface Message {
  id: string;
  channelId: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  replyToId: string | null;
  replyTo: ReplyPreview | null;
  reactions: ReactionGroup[];
  isWebhook?: boolean;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    status: string;
    tag?: string | null;
    tagBadge?: string | null;
  };
}
