"use client";
import { useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { initials, statusColor, statusLabel, displayName } from "@/lib/ui";
import type { FriendsData, PublicUserC } from "@/lib/types";

type Tab = "online" | "all" | "pending" | "add";

export function FriendsPanel({
  data,
  onChanged,
  onOpenDM,
  onMobileBack,
}: {
  data: FriendsData;
  onChanged: () => void;
  onOpenDM: (user: PublicUserC) => void;
  onMobileBack?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("online");
  const [addValue, setAddValue] = useState("");
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const online = data.friends.filter((f) => f.status !== "OFFLINE" && f.status !== "INVISIBLE");
  const pendingCount = data.incoming.length + data.outgoing.length;

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!addValue.trim()) return;
    setBusy(true);
    setAddMsg(null);
    try {
      await api("/friends/requests", { method: "POST", json: { username: addValue.trim() } });
      setAddMsg({ ok: true, text: `Friend request sent to ${addValue.trim()}.` });
      setAddValue("");
      onChanged();
    } catch (err) {
      setAddMsg({ ok: false, text: err instanceof ApiError ? err.message : "Failed to send request" });
    } finally {
      setBusy(false);
    }
  }

  async function act(path: string, method: "POST" | "DELETE") {
    await api(path, { method }).catch(() => {});
    onChanged();
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "online", label: "Online" },
    { key: "all", label: "All" },
    { key: "pending", label: "Pending", badge: pendingCount || undefined },
    { key: "add", label: "Add Friend" },
  ];

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-night-900/30">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line/5 px-4">
        {onMobileBack && (
          <button onClick={onMobileBack} className="-ml-1 text-xl text-muted hover:text-ink md:hidden" aria-label="Back" title="Back">
            ‹
          </button>
        )}
        <span className="mr-2 font-bold">Friends</span>
        <span className="mr-3 h-4 w-px bg-line/10" />
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              t.key === "add"
                ? "bg-gradient-to-r from-solar to-solar-glow text-night-900"
                : tab === t.key
                  ? "bg-night-700 text-ink"
                  : "text-muted hover:bg-night-800 hover:text-ink",
            )}
          >
            {t.label}
            {t.badge ? (
              <span className="rounded-full bg-solar-ember px-1.5 text-[10px] font-bold text-night-900">{t.badge}</span>
            ) : null}
          </button>
        ))}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "add" && (
          <div className="max-w-xl">
            <h3 className="font-bold">Add Friend</h3>
            <p className="mt-1 text-sm text-muted">You can add friends with their SolarCord username.</p>
            <form onSubmit={sendRequest} className="mt-4 flex gap-2">
              <input
                className="field"
                placeholder="Enter a username"
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
              />
              <button className="btn-solar shrink-0" disabled={busy || !addValue.trim()}>
                Send request
              </button>
            </form>
            {addMsg && (
              <p className={clsx("mt-2 text-sm", addMsg.ok ? "text-emerald-400" : "text-solar-ember")}>{addMsg.text}</p>
            )}
          </div>
        )}

        {tab === "pending" && (
          <div className="space-y-5">
            {pendingCount === 0 && <Empty text="No pending requests." />}
            {data.incoming.length > 0 && (
              <Group title={`Incoming — ${data.incoming.length}`}>
                {data.incoming.map((r) => (
                  <Row key={r.id} user={r.user}>
                    <IconBtn title="Accept" tone="ok" onClick={() => act(`/friends/requests/${r.id}/accept`, "POST")}>
                      ✓
                    </IconBtn>
                    <IconBtn title="Ignore" tone="bad" onClick={() => act(`/friends/requests/${r.id}`, "DELETE")}>
                      ✕
                    </IconBtn>
                  </Row>
                ))}
              </Group>
            )}
            {data.outgoing.length > 0 && (
              <Group title={`Outgoing — ${data.outgoing.length}`}>
                {data.outgoing.map((r) => (
                  <Row key={r.id} user={r.user} subtitle="Request sent">
                    <IconBtn title="Cancel" tone="bad" onClick={() => act(`/friends/requests/${r.id}`, "DELETE")}>
                      ✕
                    </IconBtn>
                  </Row>
                ))}
              </Group>
            )}
          </div>
        )}

        {(tab === "online" || tab === "all") && (
          <Group title={`${tab === "online" ? "Online" : "All friends"} — ${(tab === "online" ? online : data.friends).length}`}>
            {(tab === "online" ? online : data.friends).length === 0 && (
              <Empty text={tab === "online" ? "No friends online right now." : "You have no friends yet — add some!"} />
            )}
            {(tab === "online" ? online : data.friends).map((f) => (
              <Row key={f.id} user={f} subtitle={statusLabel(f.status)} onClick={() => onOpenDM(f)}>
                <IconBtn title="Message" onClick={() => onOpenDM(f)}>
                  ✉
                </IconBtn>
                <IconBtn title="Remove friend" tone="bad" onClick={() => act(`/friends/${f.id}`, "DELETE")}>
                  ✕
                </IconBtn>
              </Row>
            ))}
          </Group>
        )}
      </div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({
  user,
  subtitle,
  onClick,
  children,
}: {
  user: PublicUserC;
  subtitle?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition hover:border-line/10 hover:bg-night-800/50",
        onClick && "cursor-pointer",
      )}
    >
      <div className="relative">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-aurora to-solar-glow text-xs font-bold text-night-900">
          {initials(displayName(user))}
        </div>
        <span className={clsx("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-night-900", statusColor(user.status))} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{displayName(user)}</p>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  title,
  tone,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  tone?: "ok" | "bad";
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={clsx(
        "grid h-9 w-9 place-items-center rounded-full bg-night-900/60 text-sm transition hover:bg-night-700",
        tone === "ok" && "hover:text-emerald-400",
        tone === "bad" && "hover:text-solar-ember",
        !tone && "hover:text-solar",
      )}
    >
      {children}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted">{text}</p>;
}
