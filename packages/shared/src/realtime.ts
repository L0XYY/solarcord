// Realtime event contracts shared by the Socket.IO gateway and the web client.

export type PresenceStatus = "ONLINE" | "IDLE" | "DND" | "INVISIBLE" | "OFFLINE";

export interface PublicUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: PresenceStatus;
  tag?: string | null;
  tagBadge?: string | null;
}

export interface ReactionGroup {
  emoji: string;
  userIds: string[];
}

export interface MessageReplyPreview {
  id: string;
  content: string;
  author: { id: string; username: string; displayName: string | null };
}

export interface MessageDTO {
  id: string;
  channelId: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  replyToId: string | null;
  replyTo: MessageReplyPreview | null;
  author: PublicUser;
  reactions: ReactionGroup[];
  isWebhook?: boolean;
}

export interface ChannelSummary {
  id: string;
  serverId: string;
  name: string;
  type: string;
  position: number;
}

// Server → client
export interface ServerToClientEvents {
  ready: (data: { user: PublicUser; servers: { id: string; name: string }[] }) => void;
  "server:channelCreate": (channel: ChannelSummary) => void;
  "message:create": (msg: MessageDTO) => void;
  "message:update": (msg: MessageDTO) => void;
  "message:delete": (data: { id: string; channelId: string }) => void;
  "reaction:add": (data: { channelId: string; messageId: string; emoji: string; userId: string }) => void;
  "reaction:remove": (data: { channelId: string; messageId: string; emoji: string; userId: string }) => void;
  "typing:start": (data: { channelId: string; userId: string }) => void;
  "presence:update": (data: { userId: string; status: PresenceStatus }) => void;
  // Friends & DMs
  "friend:request": (data: { from: PublicUser }) => void;
  "friend:update": () => void;
  "conversation:new": (data: { id: string }) => void;
  // Voice (WebRTC signalling)
  "voice:peers": (data: { roomId: string; peers: VoicePeer[] }) => void;
  "voice:peer-joined": (data: { roomId: string; peer: VoicePeer }) => void;
  "voice:peer-left": (data: { roomId: string; socketId: string }) => void;
  "voice:signal": (data: { from: string; signal: unknown }) => void;
  "voice:state": (data: { roomId: string; userId: string; muted: boolean; deafened: boolean }) => void;
  "voice:incoming": (data: { conversationId: string; from: VoicePeer }) => void;
  error: (data: { code: string; message: string }) => void;
}

// Client → server
export interface ClientToServerEvents {
  "channel:focus": (data: { channelId: string }) => void;
  "channel:blur": (data: { channelId: string }) => void;
  "typing:start": (data: { channelId: string }) => void;
  "presence:update": (data: { status: PresenceStatus }) => void;
  // DM rooms reuse message:* events; channelId carries the conversationId.
  "conversation:focus": (data: { conversationId: string }) => void;
  "conversation:blur": (data: { conversationId: string }) => void;
  "conversation:typing": (data: { conversationId: string }) => void;
  // Voice (WebRTC signalling)
  "voice:join": (data: { roomId: string }) => void;
  "voice:leave": (data: { roomId: string }) => void;
  "voice:signal": (data: { to: string; signal: unknown }) => void;
  "voice:state": (data: { roomId: string; muted: boolean; deafened: boolean }) => void;
  "voice:call": (data: { conversationId: string }) => void;
}

export interface VoicePeer {
  socketId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export const room = {
  user: (id: string) => `user:${id}`,
  server: (id: string) => `server:${id}`,
  channel: (id: string) => `channel:${id}`,
  dm: (id: string) => `dm:${id}`,
  voice: (id: string) => `voice:${id}`,
};
