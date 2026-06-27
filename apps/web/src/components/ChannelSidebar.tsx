"use client";
import clsx from "clsx";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { statusColor, statusLabel, displayName, initials } from "@/lib/ui";
import type { Channel, ServerDetail } from "@/lib/types";

const typeGlyph: Record<string, string> = {
  TEXT: "#",
  ANNOUNCEMENT: "📣",
  VOICE: "🔊",
  VIDEO: "📹",
  STAGE: "🎤",
  FORUM: "🗂",
  MEDIA: "🖼",
  RULES: "📋",
};

export function ChannelSidebar({
  server,
  activeChannelId,
  onSelectChannel,
  onChannelCreated,
  onInvite,
  onSettings,
  onShowWelcome,
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
      <header className="flex h-14 items-center justify-between border-b border-line/5 px-4">
        <h2 className="truncate font-bold">{server?.name ?? "—"}</h2>
        <div className="flex items-center gap-1">
          {server && (
            <button
              onClick={onInvite}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-night-700 hover:text-solar"
              title="Invite people"
            >
              ⤴
            </button>
          )}
          {canManage && (
            <button
              onClick={onSettings}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-night-700 hover:text-solar"
              title="Server settings"
            >
              ⚙
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setCreating((v) => !v)}
              className="grid h-7 w-7 place-items-center rounded-lg text-xl leading-none text-muted transition hover:bg-night-700 hover:text-solar"
              title="Create channel"
            >
              +
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
          className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted transition hover:bg-night-700/60 hover:text-solar"
        >
          <span className="w-4 text-center">📖</span> Welcome
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
              <span className="w-4 text-center text-muted">{typeGlyph[c.type] ?? "#"}</span>
              <span className="truncate">{c.name}</span>
            </button>
          );
        })}
      </div>

      {/* User control panel */}
      {user && (
        <div className="flex items-center gap-2 border-t border-line/5 bg-night-900/60 px-2 py-2">
          <div className="relative">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-aurora to-solar-glow text-xs font-bold text-night-900">
              {initials(displayName(user))}
            </div>
            <span
              className={clsx(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-night-900",
                statusColor(user.status),
              )}
              title={statusLabel(user.status)}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName(user)}</p>
            <p className="truncate text-xs text-muted">{statusLabel(user.status)}</p>
          </div>
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
