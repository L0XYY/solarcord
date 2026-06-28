"use client";
import clsx from "clsx";
import Link from "next/link";
import { useAuth } from "@/lib/store";
import { initials, statusColor, statusLabel, displayName } from "@/lib/ui";
import { Avatar } from "./Avatar";
import type { ConversationSummary } from "@/lib/types";

export function conversationName(c: ConversationSummary): string {
  if (c.name) return c.name;
  if (c.participants.length === 0) return "Empty conversation";
  if (c.isGroup) return c.participants.map((p) => displayName(p)).join(", ");
  return displayName(c.participants[0]!);
}

export function HomeSidebar({
  conversations,
  activeConvId,
  friendsActive,
  pendingCount,
  onSelectFriends,
  onSelectConversation,
  onOpenUserSettings,
  onLogout,
}: {
  conversations: ConversationSummary[];
  activeConvId: string | null;
  friendsActive: boolean;
  pendingCount: number;
  onSelectFriends: () => void;
  onSelectConversation: (c: ConversationSummary) => void;
  onOpenUserSettings: () => void;
  onLogout: () => void;
}) {
  const user = useAuth((s) => s.user);

  return (
    <aside className="flex h-full w-full flex-col border-r border-line/5 bg-night-800/50 md:w-60">
      <header className="flex h-14 items-center border-b border-line/5 px-4">
        <h2 className="font-bold">Home</h2>
      </header>

      <div className="p-2">
        <button
          onClick={onSelectFriends}
          className={clsx(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
            friendsActive ? "bg-solar/15 text-solar" : "text-muted hover:bg-night-700/60 hover:text-ink",
          )}
        >
          <span className="text-lg">👥</span>
          Friends
          {pendingCount > 0 && (
            <span className="ml-auto rounded-full bg-solar-ember px-1.5 text-[10px] font-bold text-night-900">
              {pendingCount}
            </span>
          )}
        </button>
        <Link
          href="/developer"
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted transition hover:bg-night-700/60 hover:text-solar"
        >
          <span className="text-lg">🤖</span>
          Developer Portal
        </Link>
        {user?.isStaff && (
          <Link
            href="/admin"
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted transition hover:bg-night-700/60 hover:text-solar"
          >
            <span className="text-lg">🛡</span>
            Admin Console
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted">Direct Messages</p>
        {conversations.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted">No conversations yet. Message a friend to start one.</p>
        )}
        {conversations.map((c) => {
          const active = c.id === activeConvId;
          const other = c.participants[0];
          return (
            <button
              key={c.id}
              onClick={() => onSelectConversation(c)}
              className={clsx(
                "mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition",
                active ? "bg-night-700/70 text-ink" : "text-muted hover:bg-night-700/40 hover:text-ink",
              )}
            >
              <div className="relative shrink-0">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-aurora to-solar-glow text-xs font-bold text-night-900">
                  {c.isGroup ? "#" : initials(conversationName(c))}
                </div>
                {!c.isGroup && other && (
                  <span className={clsx("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-night-800", statusColor(other.status))} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{conversationName(c)}</p>
                {c.lastMessage && <p className="truncate text-xs text-muted">{c.lastMessage.content}</p>}
              </div>
            </button>
          );
        })}
      </div>

      {user && (
        <div className="flex items-center gap-2 border-t border-line/5 bg-night-900/60 px-2 py-2">
          <div className="relative">
            <Avatar name={displayName(user)} src={user.avatarUrl} size={36} />
            <span
              className={clsx("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-night-900", statusColor(user.status))}
              title={statusLabel(user.status)}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName(user)}</p>
            <p className="truncate text-xs text-muted">{statusLabel(user.status)}</p>
          </div>
          <button
            onClick={onOpenUserSettings}
            title="User settings"
            className="rounded-lg px-2 py-1 leading-none text-muted hover:bg-night-700 hover:text-ink"
          >
            ⚙
          </button>
          <button
            onClick={onLogout}
            title="Log out"
            className="rounded-lg px-2 py-1 text-lg leading-none text-muted hover:bg-night-700 hover:text-solar-ember"
          >
            ⏻
          </button>
        </div>
      )}
    </aside>
  );
}
