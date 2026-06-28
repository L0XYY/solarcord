"use client";
import clsx from "clsx";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { statusColor, statusLabel, displayName } from "@/lib/ui";
import { Avatar } from "./Avatar";
import { Icon, type IconName } from "./Icon";
import { ServerTag } from "./ServerTag";
import type { Channel, ServerDetail } from "@/lib/types";

function channelIcon(type: string): IconName {
  switch (type) {
    case "ANNOUNCEMENT":
      return "megaphone";
    case "VOICE":
    case "VIDEO":
    case "STAGE":
      return "volume";
    case "RULES":
      return "book";
    default:
      return "hash";
  }
}

export function ChannelSidebar({
  server,
  activeChannelId,
  onSelectChannel,
  onChannelCreated,
  onInvite,
  onSettings,
  onShowWelcome,
  onOpenUserSettings,
  onAvatarClick,
  onLogout,
  canManage,
}: {
  server: ServerDetail | undefined;
  activeChannelId: string | null;
  onSelectChannel: (c: Channel) => void;
  onChannelCreated: (c: Channel) => void;
  onInvite: () => void;
  onSettings: () => void;
  onShowWelcome: () => void;
  onOpenUserSettings: () => void;
  onAvatarClick: () => void;
  onLogout: () => void;
  canManage: boolean;
}) {
  const user = useAuth((s) => s.user);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!server || !newName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const { channel } = await api<{ channel: Channel }>(`/servers/${server.id}/channels`, {
        method: "POST",
        json: { name: newName.trim().toLowerCase().replace(/\s+/g, "-"), type: "TEXT" },
      });
      onChannelCreated(channel);
      setNewName("");
      setCreating(false);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-line/5 bg-night-800/50 md:w-60">
      <header className="flex h-14 items-center justify-between gap-2 border-b border-line/5 px-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="truncate font-bold">{server?.name ?? "—"}</h2>
          {server?.tag && <ServerTag tag={server.tag} badge={server.tagBadge} />}
        </div>
        <div className="flex items-center gap-1">
          {server && (
            <button
              onClick={onInvite}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-night-700 hover:text-ink"
              title="Invite people"
            >
              <Icon name="userPlus" size={16} />
            </button>
          )}
          {canManage && (
            <button
              onClick={onSettings}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-night-700 hover:text-ink"
              title="Server settings"
            >
              <Icon name="settings" size={16} />
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setCreating((v) => !v)}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-night-700 hover:text-ink"
              title="Create channel"
            >
              <Icon name="plus" size={18} />
            </button>
          )}
        </div>
      </header>

      {creating && (
        <form onSubmit={createChannel} className="border-b border-line/5 p-3">
          <input
            autoFocus
            className="field py-2 text-sm"
            placeholder="new-channel"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          {err && <p className="mt-1 text-xs text-solar-ember">{err}</p>}
          <button className="btn-solar mt-2 w-full py-1.5 text-xs" disabled={busy}>
            {busy ? "Creating…" : "Create channel"}
          </button>
        </form>
      )}

      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        <button
          onClick={onShowWelcome}
          className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted transition hover:bg-night-700/60 hover:text-ink"
        >
          <Icon name="book" size={16} className="shrink-0" /> Welcome
        </button>
        <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Channels
        </p>
        {server?.channels.map((c) => {
          const active = c.id === activeChannelId;
          const selectable = c.type === "TEXT" || c.type === "ANNOUNCEMENT";
          return (
            <button
              key={c.id}
              disabled={!selectable}
              onClick={() => selectable && onSelectChannel(c)}
              className={clsx(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
                active ? "bg-solar/15 text-solar" : "text-muted hover:bg-night-700/60 hover:text-ink",
                !selectable && "opacity-60",
              )}
            >
              <Icon name={channelIcon(c.type)} size={16} className="shrink-0 text-muted" />
              <span className="truncate">{c.name}</span>
            </button>
          );
        })}
      </div>

      {/* User control panel */}
      {user && (
        <div className="flex items-center gap-2 border-t border-line/5 bg-night-900/60 px-2 py-2">
          <button onClick={onAvatarClick} className="relative shrink-0 transition hover:opacity-80" title="View profile">
            <Avatar name={displayName(user)} src={user.avatarUrl} size={36} />
            <span
              className={clsx(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-night-900",
                statusColor(user.status),
              )}
              title={statusLabel(user.status)}
            />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName(user)}</p>
            <p className="truncate text-xs text-muted">{statusLabel(user.status)}</p>
          </div>
          <button
            onClick={onOpenUserSettings}
            title="User settings"
            className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-night-700 hover:text-ink"
          >
            <Icon name="settings" size={16} />
          </button>
          <button
            onClick={onLogout}
            title="Log out"
            className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-night-700 hover:text-solar-ember"
          >
            <Icon name="logout" size={16} />
          </button>
        </div>
      )}
    </aside>
  );
}
