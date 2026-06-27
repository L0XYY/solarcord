"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { api, bootstrapSession } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { initials, displayName } from "@/lib/ui";
import { BadgeChip } from "@/components/BadgeChip";
import { SERVER_BADGE_INFO, type ServerBadgeType } from "@solarcord/shared";

type Tab = "overview" | "users" | "servers" | "badges" | "reports";

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [state, setState] = useState<"loading" | "denied" | "ok">("loading");
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    (async () => {
      let u = user;
      if (!u) {
        await bootstrapSession();
        u = useAuth.getState().user;
      }
      if (!u) return router.replace("/login");
      setState(u.isStaff ? "ok" : "denied");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "loading")
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-solar/30 border-t-solar" />
      </main>
    );

  if (state === "denied")
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-night-700 text-2xl">🔒</div>
          <h1 className="text-xl font-bold">Staff access only</h1>
          <p className="mt-1 text-sm text-muted">This area is restricted to SolarCord staff.</p>
          <Link href="/app" className="btn-ghost mt-6 inline-flex">
            Back to SolarCord
          </Link>
        </div>
      </main>
    );

  return (
    <main className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-line/5 bg-night-900/50 p-4">
        <div className="flex items-center gap-2 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-solar to-solar-glow text-night-900">
            <span className="font-black">S</span>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">SolarCord</p>
            <p className="text-[11px] text-muted">Admin Console</p>
          </div>
        </div>
        <nav className="mt-6 space-y-1">
          {(["overview", "users", "servers", "badges", "reports"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "w-full rounded-lg px-3 py-2 text-left text-sm font-medium capitalize transition",
                tab === t ? "bg-solar/15 text-solar" : "text-muted hover:bg-night-700/60 hover:text-ink",
              )}
            >
              {t}
            </button>
          ))}
        </nav>
        <Link href="/app" className="btn-ghost mt-6 w-full text-sm">
          ← Back to app
        </Link>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-8">
        {tab === "overview" && <Overview />}
        {tab === "users" && <Users />}
        {tab === "servers" && <Servers />}
        {tab === "badges" && <Badges />}
        {tab === "reports" && <Reports />}
      </div>
    </main>
  );
}

function Overview() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    api<{ stats: Record<string, number> }>("/admin/stats").then((r) => setStats(r.stats));
  }, []);
  const cards = [
    { key: "users", label: "Total users" },
    { key: "servers", label: "Total servers" },
    { key: "suspended", label: "Suspended users" },
    { key: "pendingApps", label: "Pending badge apps" },
    { key: "openReports", label: "Open reports" },
  ];
  return (
    <div>
      <h1 className="text-2xl font-extrabold">Overview</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <div key={c.key} className="rounded-2xl glass p-5">
            <p className="text-sm text-muted">{c.label}</p>
            <p className="mt-1 text-3xl font-extrabold solar-text">{stats ? (stats[c.key] ?? 0) : "—"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AdminUser {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  isStaff: boolean;
  isSuspended: boolean;
}

function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const load = (query: string) => api<{ users: AdminUser[] }>(`/admin/users?q=${encodeURIComponent(query)}`).then((r) => setUsers(r.users));
  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  async function toggle(u: AdminUser) {
    await api(`/admin/users/${u.id}/${u.isSuspended ? "unsuspend" : "suspend"}`, { method: "POST" }).catch(() => {});
    await load(q);
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Users</h1>
      <input className="field mt-4 max-w-md" placeholder="Search by username or email…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 space-y-1">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 rounded-xl glass px-3 py-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-aurora to-solar-glow text-xs font-bold text-night-900">
              {initials(displayName(u))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {displayName(u)} {u.isStaff && <span className="ml-1 rounded bg-solar/20 px-1.5 text-[10px] text-solar">STAFF</span>}
              </p>
              <p className="truncate text-xs text-muted">{u.email}</p>
            </div>
            {u.isSuspended && <span className="rounded-full bg-solar-ember/20 px-2 py-0.5 text-[11px] text-solar-ember">Suspended</span>}
            <button onClick={() => toggle(u)} className="btn-ghost py-1.5 text-xs">
              {u.isSuspended ? "Unsuspend" : "Suspend"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AdminServer {
  id: string;
  name: string;
  memberCount: number;
  visibility: string;
  isVerified: boolean;
  isPartnered: boolean;
  isRemoved: boolean;
  category: string | null;
}

function Servers() {
  const [servers, setServers] = useState<AdminServer[]>([]);
  const [q, setQ] = useState("");
  const load = (query: string) => api<{ servers: AdminServer[] }>(`/admin/servers?q=${encodeURIComponent(query)}`).then((r) => setServers(r.servers));
  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  async function setFlag(s: AdminServer, flag: "isVerified" | "isPartnered", value: boolean) {
    await api(`/admin/servers/${s.id}/verify`, { method: "POST", json: { [flag]: value } }).catch(() => {});
    await load(q);
  }
  async function remove(s: AdminServer) {
    if (!confirm(`Take down "${s.name}"? It will be hidden from discovery.`)) return;
    await api(`/admin/servers/${s.id}/remove`, { method: "POST" }).catch(() => {});
    await load(q);
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Servers</h1>
      <input className="field mt-4 max-w-md" placeholder="Search servers…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 space-y-1">
        {servers.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl glass px-3 py-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-night-700 text-xs font-bold">{initials(s.name)}</div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                {s.name}
                {s.isVerified && <BadgeChip type="VERIFIED" />}
                {s.isPartnered && <BadgeChip type="SOLAR_PARTNER" />}
                {s.isRemoved && <span className="rounded bg-solar-ember/20 px-1.5 text-[10px] text-solar-ember">REMOVED</span>}
              </p>
              <p className="truncate text-xs text-muted">
                {s.memberCount} members · {s.category ?? "no category"} · {s.visibility.toLowerCase()}
              </p>
            </div>
            <button onClick={() => setFlag(s, "isVerified", !s.isVerified)} className="btn-ghost py-1.5 text-xs">
              {s.isVerified ? "Unverify" : "Verify"}
            </button>
            <button onClick={() => setFlag(s, "isPartnered", !s.isPartnered)} className="btn-ghost py-1.5 text-xs">
              {s.isPartnered ? "Unpartner" : "Partner"}
            </button>
            {!s.isRemoved && (
              <button onClick={() => remove(s)} className="rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-night-700 hover:text-solar-ember">
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface BadgeApp {
  id: string;
  type: string;
  reason: string | null;
  status: string;
  server: { id: string; name: string; iconUrl: string | null; memberCount: number };
  createdAt: string;
}

function Badges() {
  const [apps, setApps] = useState<BadgeApp[]>([]);
  const load = () => api<{ applications: BadgeApp[] }>("/admin/badge-applications?status=PENDING").then((r) => setApps(r.applications));
  useEffect(() => {
    void load();
  }, []);

  async function review(id: string, status: "APPROVED" | "REJECTED") {
    const reviewNote = status === "REJECTED" ? prompt("Reason for rejection (optional):") ?? undefined : undefined;
    await api(`/admin/badge-applications/${id}/review`, { method: "POST", json: { status, reviewNote } }).catch(() => {});
    await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Badge Applications</h1>
      <p className="mt-1 text-sm text-muted">Review verified, partner and safe-community requests.</p>
      {apps.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No pending applications. 🎉</p>
      ) : (
        <div className="mt-6 space-y-3">
          {apps.map((a) => {
            const info = SERVER_BADGE_INFO[a.type as ServerBadgeType];
            return (
              <div key={a.id} className="rounded-2xl glass p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-night-700 text-lg font-bold">{initials(a.server.name)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {a.server.name}
                      <span className="flex items-center gap-1 rounded-full bg-night-700/70 px-2 py-0.5 text-xs">
                        {info?.icon} {info?.label ?? a.type}
                      </span>
                    </p>
                    <p className="text-xs text-muted">{a.server.memberCount} members</p>
                  </div>
                  <button onClick={() => review(a.id, "APPROVED")} className="btn-solar py-1.5 text-xs">
                    Approve
                  </button>
                  <button onClick={() => review(a.id, "REJECTED")} className="btn-ghost py-1.5 text-xs">
                    Reject
                  </button>
                </div>
                {a.reason && <p className="mt-3 rounded-xl bg-night-900/50 p-3 text-sm text-muted">{a.reason}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ReportRow {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  reporter: { id: string; username: string; displayName: string | null };
  createdAt: string;
}

function Reports() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const load = () => api<{ reports: ReportRow[] }>("/admin/reports?status=OPEN").then((r) => setReports(r.reports));
  useEffect(() => {
    void load();
  }, []);

  async function resolve(id: string, status: "RESOLVED" | "DISMISSED") {
    await api(`/admin/reports/${id}/resolve`, { method: "POST", json: { status } }).catch(() => {});
    await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Reports</h1>
      <p className="mt-1 text-sm text-muted">Open reports filed by users against messages, people, and servers.</p>
      {reports.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No open reports. 🎉</p>
      ) : (
        <div className="mt-6 space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-2xl glass p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-night-700/70 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">{r.targetType}</span>
                <span className="text-xs text-muted">
                  reported by {displayName(r.reporter)} · <span className="font-mono">{r.targetId.slice(0, 10)}…</span>
                </span>
                <div className="ml-auto flex gap-2">
                  <button onClick={() => resolve(r.id, "RESOLVED")} className="btn-solar py-1.5 text-xs">
                    Action taken
                  </button>
                  <button onClick={() => resolve(r.id, "DISMISSED")} className="btn-ghost py-1.5 text-xs">
                    Dismiss
                  </button>
                </div>
              </div>
              <p className="mt-3 rounded-xl bg-night-900/50 p-3 text-sm text-muted">{r.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
