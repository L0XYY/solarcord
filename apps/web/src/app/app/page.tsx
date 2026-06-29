"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { api, bootstrapSession } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { connectSocket, disconnectSocket, type AppSocket } from "@/lib/socket";
import { joinVoice, ringDM, setChannelOccupants } from "@/lib/voice";
import { displayName } from "@/lib/ui";
import { ServerDock } from "@/components/ServerDock";
import { ChannelSidebar } from "@/components/ChannelSidebar";
import { ChatPanel } from "@/components/ChatPanel";
import { MemberList } from "@/components/MemberList";
import { CreateServerModal } from "@/components/CreateServerModal";
import { InviteModal } from "@/components/InviteModal";
import { HomeSidebar, conversationName } from "@/components/HomeSidebar";
import { FriendsPanel } from "@/components/FriendsPanel";
import { ServerSettingsModal } from "@/components/ServerSettingsModal";
import { DiscoveryPage } from "@/components/DiscoveryPage";
import { WelcomeModal } from "@/components/WelcomeModal";
import { UserSettingsModal } from "@/components/UserSettingsModal";
import { ProfileCard } from "@/components/ProfileCard";
import { VideoStage } from "@/components/VideoStage";
import { EmailVerifyBanner } from "@/components/EmailVerifyBanner";
import { has, Permission, type ChannelSummary } from "@solarcord/shared";
import type {
  Channel,
  ConversationSummary,
  FriendsData,
  MemberView,
  Message,
  PublicUserC,
  ServerDetail,
  ServerSummary,
} from "@/lib/types";

type View = "home" | "server" | "discovery";
type ChatTarget = { kind: "channel"; channel: Channel } | { kind: "dm"; conv: ConversationSummary } | null;

const emptyFriends: FriendsData = { friends: [], incoming: [], outgoing: [] };

export default function AppPage() {
  const router = useRouter();
  const { accessToken, user, clear } = useAuth();
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("home");

  // Server state
  const [servers, setServers] = useState<ServerSummary[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ServerDetail | undefined>();
  const [members, setMembers] = useState<MemberView[]>([]);
  const [channel, setChannel] = useState<Channel | null>(null);

  // Home / DM state
  const [friends, setFriends] = useState<FriendsData>(emptyFriends);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationSummary | null>(null);

  // Shared chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ conversationId: string; fromName: string } | null>(null);
  // On mobile we show one pane at a time: false = list/sidebar, true = chat/friends.
  const [mobileChat, setMobileChat] = useState(false);

  const socketRef = useRef<AppSocket | null>(null);
  const channelIdRef = useRef<string | null>(null);

  // The current chat target derived from the active view.
  const chatTarget: ChatTarget =
    view === "server" && channel
      ? { kind: "channel", channel }
      : view === "home" && activeConv
        ? { kind: "dm", conv: activeConv }
        : null;
  const chatTargetRef = useRef<ChatTarget>(null);
  chatTargetRef.current = chatTarget;

  // ── 1) Auth + gateway + initial data ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let token = accessToken;
      if (!token) {
        const ok = await bootstrapSession();
        if (!ok) return router.replace("/login");
        token = useAuth.getState().accessToken;
      }
      if (cancelled || !token) return;

      socketRef.current = connectSocket(token);
      setReady(true);

      const [{ servers: list }, friendsData, { conversations: convos }] = await Promise.all([
        api<{ servers: ServerSummary[] }>("/servers"),
        api<FriendsData>("/friends"),
        api<{ conversations: ConversationSummary[] }>("/dms"),
      ]);
      if (cancelled) return;
      setServers(list);
      setFriends(friendsData);
      setConversations(convos);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetchFriends = useCallback(() => {
    api<FriendsData>("/friends").then(setFriends).catch(() => {});
  }, []);
  const refetchConversations = useCallback(
    () => api<{ conversations: ConversationSummary[] }>("/dms").then((r) => setConversations(r.conversations)).catch(() => {}),
    [],
  );
  const refetchServer = useCallback(() => {
    if (!activeServerId) return;
    void Promise.all([
      api<{ server: ServerDetail }>(`/servers/${activeServerId}`),
      api<{ members: MemberView[] }>(`/servers/${activeServerId}/members`),
    ])
      .then(([s, m]) => {
        setDetail(s.server);
        setMembers(m.members);
      })
      .catch(() => {});
  }, [activeServerId]);

  // ── 2) Socket listeners ──
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !ready) return;

    const matches = (channelId: string) => channelId === channelIdRef.current;

    const onMessage = (m: Message) => {
      if (!matches(m.channelId)) return;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    };
    const onMessageUpdate = (m: Message) => {
      if (!matches(m.channelId)) return;
      setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
    };
    const onMessageDelete = ({ id, channelId }: { id: string; channelId: string }) => {
      if (!matches(channelId)) return;
      setMessages((prev) => prev.filter((x) => x.id !== id));
    };
    const onReaction =
      (add: boolean) =>
      (d: { channelId: string; messageId: string; emoji: string; userId: string }) => {
        if (!matches(d.channelId)) return;
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== d.messageId) return msg;
            const groups = msg.reactions.map((r) => ({ ...r, userIds: [...r.userIds] }));
            const g = groups.find((r) => r.emoji === d.emoji);
            if (add) {
              if (g) {
                if (!g.userIds.includes(d.userId)) g.userIds.push(d.userId);
              } else groups.push({ emoji: d.emoji, userIds: [d.userId] });
            } else if (g) g.userIds = g.userIds.filter((u) => u !== d.userId);
            return { ...msg, reactions: groups.filter((r) => r.userIds.length > 0) };
          }),
        );
      };
    const onPresence = ({ userId, status }: { userId: string; status: string }) => {
      setMembers((prev) => prev.map((mb) => (mb.user.id === userId ? { ...mb, user: { ...mb.user, status } } : mb)));
      setFriends((prev) => ({ ...prev, friends: prev.friends.map((f) => (f.id === userId ? { ...f, status } : f)) }));
      const u = useAuth.getState().user;
      if (u && userId === u.id) useAuth.getState().setAuth(useAuth.getState().accessToken!, { ...u, status });
    };
    const onTyping = ({ channelId, userId }: { channelId: string; userId: string }) => {
      if (!matches(channelId) || userId === user?.id) return;
      setTyping((prev) => ({ ...prev, [userId]: Date.now() + 4000 }));
    };
    const onChannelCreate = (c: ChannelSummary) => {
      const ch: Channel = { ...c, topic: null };
      setDetail((d) => (d && d.id === c.serverId && !d.channels.some((x) => x.id === c.id) ? { ...d, channels: [...d.channels, ch] } : d));
    };
    const onFriendRequest = () => refetchFriends();
    const onFriendUpdate = () => refetchFriends();
    const onConversationNew = ({ id }: { id: string }) => {
      socket.emit("conversation:focus", { conversationId: id });
      void refetchConversations();
    };
    const onIncomingCall = (d: { conversationId: string; from: { username: string; displayName: string | null } }) => {
      setIncomingCall({ conversationId: d.conversationId, fromName: d.from.displayName ?? d.from.username });
    };
    const onVoiceChannelUpdate = (d: { channelId: string; users: Parameters<typeof setChannelOccupants>[1] }) => {
      setChannelOccupants(d.channelId, d.users);
    };
    const onMemberUpdate = (d: { serverId: string; userId: string; roleIds: string[] }) => {
      setMembers((prev) => prev.map((mb) => (mb.user.id === d.userId ? { ...mb, roleIds: d.roleIds } : mb)));
    };
    const onRolesUpdate = (d: { serverId: string; roles: ServerDetail["roles"] }) => {
      setDetail((dt) => (dt && dt.id === d.serverId ? { ...dt, roles: d.roles } : dt));
    };
    const onServerBoost = (d: { serverId: string; boostCount: number; boostLevel: number }) => {
      setDetail((dt) => (dt && dt.id === d.serverId ? { ...dt, boostCount: d.boostCount, boostLevel: d.boostLevel } : dt));
    };

    socket.on("message:create", onMessage);
    socket.on("message:update", onMessageUpdate);
    socket.on("message:delete", onMessageDelete);
    socket.on("reaction:add", onReaction(true));
    socket.on("reaction:remove", onReaction(false));
    socket.on("presence:update", onPresence);
    socket.on("typing:start", onTyping);
    socket.on("server:channelCreate", onChannelCreate);
    socket.on("friend:request", onFriendRequest);
    socket.on("friend:update", onFriendUpdate);
    socket.on("conversation:new", onConversationNew);
    socket.on("voice:incoming", onIncomingCall);
    socket.on("voice:channel-update", onVoiceChannelUpdate);
    socket.on("member:update", onMemberUpdate);
    socket.on("server:boost", onServerBoost);
    socket.on("server:roles", onRolesUpdate);

    return () => {
      socket.off("message:create", onMessage);
      socket.off("message:update", onMessageUpdate);
      socket.off("message:delete", onMessageDelete);
      socket.off("reaction:add");
      socket.off("reaction:remove");
      socket.off("presence:update", onPresence);
      socket.off("typing:start", onTyping);
      socket.off("server:channelCreate", onChannelCreate);
      socket.off("friend:request", onFriendRequest);
      socket.off("friend:update", onFriendUpdate);
      socket.off("conversation:new", onConversationNew);
      socket.off("voice:incoming", onIncomingCall);
      socket.off("voice:channel-update", onVoiceChannelUpdate);
      socket.off("member:update", onMemberUpdate);
      socket.off("server:boost", onServerBoost);
      socket.off("server:roles", onRolesUpdate);
    };
  }, [ready, user, refetchFriends, refetchConversations]);

  // Expire stale typing indicators.
  useEffect(() => {
    const t = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(prev).filter(([, exp]) => exp > now));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ── 3) Load server detail + members on server change ──
  useEffect(() => {
    if (view !== "server" || !activeServerId) return;
    let cancelled = false;
    (async () => {
      const [{ server }, { members: mlist }] = await Promise.all([
        api<{ server: ServerDetail }>(`/servers/${activeServerId}`),
        api<{ members: MemberView[] }>(`/servers/${activeServerId}/members`),
      ]);
      if (cancelled) return;
      setDetail(server);
      setMembers(mlist);
      setChannel(server.channels.find((c) => c.type === "TEXT" || c.type === "ANNOUNCEMENT") ?? null);
      socketRef.current?.emit("voice:sync", { serverId: activeServerId });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeServerId, view]);

  // ── 4) Load history + join realtime room on chat target change ──
  useEffect(() => {
    const prevId = channelIdRef.current;
    const target = chatTarget;
    const nextId = target ? (target.kind === "channel" ? target.channel.id : target.conv.id) : null;
    if (prevId === nextId) return;

    const socket = socketRef.current;
    // Leave the previous room (kind tracked implicitly by which room the server has us in).
    if (prevId && socket) {
      socket.emit("channel:blur", { channelId: prevId });
      socket.emit("conversation:blur", { conversationId: prevId });
    }
    channelIdRef.current = nextId;
    setTyping({});

    if (!target) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    (async () => {
      if (target.kind === "channel") {
        socket?.emit("channel:focus", { channelId: target.channel.id });
        const { messages: h } = await api<{ messages: Message[] }>(`/channels/${target.channel.id}/messages?limit=50`);
        if (!cancelled) setMessages([...h].reverse());
      } else {
        socket?.emit("conversation:focus", { conversationId: target.conv.id });
        const { messages: h } = await api<{ messages: Message[] }>(`/dms/${target.conv.id}/messages?limit=50`);
        if (!cancelled) setMessages([...h].reverse());
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatTarget?.kind, chatTarget && (chatTarget.kind === "channel" ? chatTarget.channel.id : chatTarget.conv.id)]);

  // ── Chat actions (branch on target kind) ──
  const basePath = useCallback(() => {
    const t = chatTargetRef.current;
    if (!t) return null;
    return t.kind === "channel" ? `/channels/${t.channel.id}` : `/dms/${t.conv.id}`;
  }, []);

  const sendMessage = useCallback(
    async (content: string, replyToId?: string) => {
      const base = basePath();
      if (!base) return;
      await api(`${base}/messages`, { method: "POST", json: { content, ...(replyToId ? { replyToId } : {}) } });
    },
    [basePath],
  );
  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      const base = basePath();
      if (base) await api(`${base}/messages/${messageId}`, { method: "PATCH", json: { content } });
    },
    [basePath],
  );
  const deleteMessage = useCallback(
    async (messageId: string) => {
      const base = basePath();
      if (base) await api(`${base}/messages/${messageId}`, { method: "DELETE" });
    },
    [basePath],
  );
  const reportMessage = useCallback((messageId: string) => {
    const reason = prompt("Report this message — what's wrong with it?");
    if (!reason || !reason.trim()) return;
    void api("/reports", { method: "POST", json: { targetType: "message", targetId: messageId, reason: reason.trim() } })
      .then(() => alert("Thanks — your report was sent to the SolarCord team."))
      .catch(() => {});
  }, []);

  const toggleReaction = useCallback((messageId: string, emoji: string, mine: boolean) => {
    const t = chatTargetRef.current;
    if (t?.kind !== "channel") return; // reactions only on server messages for now
    const path = `/channels/${t.channel.id}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`;
    void api(path, { method: mine ? "DELETE" : "PUT" }).catch(() => {});
  }, []);

  const lastTyped = useRef(0);
  const emitTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTyped.current < 2500) return;
    lastTyped.current = now;
    const t = chatTargetRef.current;
    if (t?.kind === "channel") socketRef.current?.emit("typing:start", { channelId: t.channel.id });
    else if (t?.kind === "dm") socketRef.current?.emit("conversation:typing", { conversationId: t.conv.id });
  }, []);

  // Open (or create) a 1:1 DM with a user, then focus it.
  const openDM = useCallback(
    async (target: PublicUserC) => {
      const { conversation } = await api<{ conversation: { id: string } }>("/dms", {
        method: "POST",
        json: { userIds: [target.id] },
      });
      const { conversations: convos } = await api<{ conversations: ConversationSummary[] }>("/dms");
      setConversations(convos);
      const conv = convos.find((c) => c.id === conversation.id) ?? {
        id: conversation.id,
        isGroup: false,
        name: null,
        iconUrl: null,
        participants: [target],
        lastMessage: null,
      };
      socketRef.current?.emit("conversation:focus", { conversationId: conv.id });
      setView("home");
      setActiveConv(conv);
      setMobileChat(true);
    },
    [],
  );

  // After joining a server from discovery: refresh the list and switch to it.
  const handleJoined = useCallback(async (serverId: string) => {
    const { servers: list } = await api<{ servers: ServerSummary[] }>("/servers");
    setServers(list);
    setView("server");
    setActiveServerId(serverId);
  }, []);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    disconnectSocket();
    clear();
    router.replace("/login");
  }

  // Resolve userId → name for typing indicator across all contexts.
  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) map.set(m.user.id, m.nickname ?? displayName(m.user));
    for (const f of friends.friends) map.set(f.id, displayName(f));
    for (const c of conversations) for (const p of c.participants) map.set(p.id, displayName(p));
    return map;
  }, [members, friends, conversations]);
  const typingNames = Object.keys(typing).map((uid) => nameOf.get(uid) ?? "Someone");

  const pendingCount = friends.incoming.length;

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-solar/30 border-t-solar" />
      </main>
    );
  }

  // Build the channel-like object the ChatPanel renders.
  const panelChannel: Channel | null =
    chatTarget?.kind === "channel"
      ? chatTarget.channel
      : chatTarget?.kind === "dm"
        ? { id: chatTarget.conv.id, serverId: "", name: conversationName(chatTarget.conv), type: "DM", topic: null, position: 0 }
        : null;
  const isDM = chatTarget?.kind === "dm";

  // Show the manage/settings affordances when the viewer holds any management permission.
  const canManageServer =
    !!detail &&
    (detail.me.isOwner ||
      [
        Permission.MANAGE_SERVER,
        Permission.MANAGE_ROLES,
        Permission.MANAGE_CHANNELS,
        Permission.KICK_MEMBERS,
        Permission.BAN_MEMBERS,
        Permission.VIEW_AUDIT_LOG,
      ].some((p) => has(detail.me.permissions, p)));

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <EmailVerifyBanner />
      <main className="flex min-h-0 flex-1 overflow-hidden">
      <VideoStage />
      <ServerDock
        servers={servers}
        activeId={view === "server" ? activeServerId : null}
        homeActive={view === "home"}
        discoverActive={view === "discovery"}
        onHome={() => {
          setView("home");
          setMobileChat(false);
        }}
        onDiscover={() => setView("discovery")}
        onSelect={(id) => {
          setView("server");
          setActiveServerId(id);
          setMobileChat(false);
        }}
        onCreate={() => setShowCreate(true)}
      />

      {view === "discovery" && <DiscoveryPage onJoined={handleJoined} />}

      {view !== "discovery" && (
        <>
          <div className={clsx("h-full shrink-0", mobileChat ? "hidden md:block" : "block w-full md:w-auto")}>
            {view === "home" ? (
              <HomeSidebar
                conversations={conversations}
                activeConvId={activeConv?.id ?? null}
                friendsActive={!activeConv}
                pendingCount={pendingCount}
                onSelectFriends={() => {
                  setActiveConv(null);
                  setMobileChat(true);
                }}
                onSelectConversation={(c) => {
                  setActiveConv(c);
                  setMobileChat(true);
                }}
                onOpenUserSettings={() => setShowUserSettings(true)}
                onAvatarClick={() => user && setProfileUserId(user.id)}
                onLogout={logout}
              />
            ) : (
              <ChannelSidebar
                server={detail}
                activeChannelId={channel?.id ?? null}
                onSelectChannel={(c) => {
                  setChannel(c);
                  setMobileChat(true);
                }}
                onChannelCreated={(c) => setDetail((d) => (d ? { ...d, channels: [...d.channels, c] } : d))}
                onInvite={() => setShowInvite(true)}
                onSettings={() => setShowSettings(true)}
                onShowWelcome={() => setShowWelcome(true)}
                onOpenUserSettings={() => setShowUserSettings(true)}
                onAvatarClick={() => user && setProfileUserId(user.id)}
                onLogout={logout}
                canManage={canManageServer}
              />
            )}
          </div>

          <div className={clsx("h-full min-w-0 flex-1", mobileChat ? "flex" : "hidden md:flex")}>
            {view === "home" && !activeConv ? (
              <FriendsPanel data={friends} onChanged={refetchFriends} onOpenDM={openDM} onMobileBack={() => setMobileChat(false)} />
            ) : (
              <ChatPanel
                channel={panelChannel}
                messages={messages}
                typingNames={typingNames}
                currentUserId={user?.id ?? ""}
                canManageMessages={!isDM && !!user && !!detail && detail.ownerId === user.id}
                enableReactions={!isDM}
                placeholderLabel={isDM && panelChannel ? `Message @${panelChannel.name}` : undefined}
                onSend={sendMessage}
                onTyping={emitTyping}
                onEdit={editMessage}
                onDelete={deleteMessage}
                onToggleReaction={toggleReaction}
                onReport={isDM ? undefined : reportMessage}
                onMobileBack={() => setMobileChat(false)}
                onSelectUser={setProfileUserId}
                onStartCall={
                  isDM && chatTarget?.kind === "dm"
                    ? () => {
                        const conv = chatTarget.conv;
                        void joinVoice(conv.id, conversationName(conv), "dm");
                        ringDM(conv.id);
                      }
                    : undefined
                }
              />
            )}
          </div>

          {view === "server" && <MemberList members={members} roles={detail?.roles ?? []} onSelectUser={(id) => setProfileUserId(id)} />}
        </>
      )}

      {view === "server" && servers.length === 0 && !showCreate && <EmptyState onCreate={() => setShowCreate(true)} />}

      {showCreate && (
        <CreateServerModal
          onClose={() => setShowCreate(false)}
          onCreated={(server) => {
            setServers((s) => [...s, { id: server.id, name: server.name, iconUrl: server.iconUrl }]);
            setView("server");
            setActiveServerId(server.id);
            setShowCreate(false);
          }}
        />
      )}
      {showInvite && detail && <InviteModal serverId={detail.id} serverName={detail.name} onClose={() => setShowInvite(false)} />}
      {showSettings && detail && (
        <ServerSettingsModal
          serverId={detail.id}
          serverName={detail.name}
          me={detail.me}
          onChanged={refetchServer}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showWelcome && detail && <WelcomeModal serverId={detail.id} onClose={() => setShowWelcome(false)} />}
      {showUserSettings && <UserSettingsModal onClose={() => setShowUserSettings(false)} />}
      {incomingCall && (
        <div className="animate-pop fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-2xl glass-strong px-5 py-4 shadow-glass">
          <p className="text-sm font-semibold">Incoming call</p>
          <p className="text-xs text-muted">{incomingCall.fromName} is calling…</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                void joinVoice(incomingCall.conversationId, `Call with ${incomingCall.fromName}`, "dm");
                setIncomingCall(null);
              }}
              className="btn-solar flex-1 py-1.5 text-sm"
            >
              Accept
            </button>
            <button onClick={() => setIncomingCall(null)} className="btn-ghost flex-1 py-1.5 text-sm">
              Decline
            </button>
          </div>
        </div>
      )}
      {profileUserId && (
        <ProfileCard
          userId={profileUserId}
          roles={
            detail
              ? detail.roles
                  .filter((r) => !r.isEveryone && (members.find((m) => m.user.id === profileUserId)?.roleIds ?? []).includes(r.id))
                  .map((r) => ({ id: r.id, name: r.name, color: r.color, iconUrl: r.iconUrl }))
              : undefined
          }
          onClose={() => setProfileUserId(null)}
        />
      )}
      </main>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 left-[316px] grid place-items-center">
      <div className="pointer-events-auto max-w-sm text-center">
        <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-gradient-to-br from-solar to-solar-glow shadow-glow" />
        <h2 className="text-xl font-bold">No servers yet</h2>
        <p className="mt-1 text-sm text-muted">Create your first server to start chatting.</p>
        <button onClick={onCreate} className="btn-solar mt-4">
          Create a server
        </button>
      </div>
    </div>
  );
}
