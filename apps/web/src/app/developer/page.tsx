"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, API_URL, bootstrapSession } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { initials } from "@/lib/ui";
import type { ServerSummary } from "@/lib/types";

interface BotApp {
  id: string;
  name: string;
  description: string | null;
  token: string;
  bot: { id: string; username: string; avatarUrl: string | null } | null;
  createdAt: string;
}

export default function DeveloperPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [apps, setApps] = useState<BotApp[]>([]);
  const [servers, setServers] = useState<ServerSummary[]>([]);
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [{ apps: a }, { servers: s }] = await Promise.all([
      api<{ apps: BotApp[] }>("/developer/apps"),
      api<{ servers: ServerSummary[] }>("/servers"),
    ]);
    setApps(a);
    setServers(s);
  };

  useEffect(() => {
    (async () => {
      if (!useAuth.getState().accessToken) {
        const ok = await bootstrapSession();
        if (!ok) return router.replace("/login");
      }
      await load();
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (name.trim().length < 2) return;
    setError(null);
    try {
      await api("/developer/apps", { method: "POST", json: { name: name.trim() } });
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create app");
    }
  }
  async function resetToken(id: string) {
    await api(`/developer/apps/${id}/reset-token`, { method: "POST" }).catch(() => {});
    await load();
  }
  async function del(id: string) {
    if (!confirm("Delete this bot and remove it from all servers?")) return;
    await api(`/developer/apps/${id}`, { method: "DELETE" }).catch(() => {});
    await load();
  }
  async function copy(token: string, id: string) {
    await navigator.clipboard.writeText(token).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }
  async function addToServer(appId: string, serverId: string) {
    if (!serverId) return;
    try {
      await api(`/servers/${serverId}/bots`, { method: "POST", json: { applicationId: appId } });
      alert("Bot added to the server.");
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Couldn't add bot (need Manage Server there).");
    }
  }

  if (!ready)
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-solar/30 border-t-solar" />
      </main>
    );

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">
            Developer <span className="solar-text">Portal</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Build bots and apps for SolarCord.</p>
        </div>
        <Link href="/app" className="btn-ghost text-sm">
          ← Back to app
        </Link>
      </div>

      <div className="mt-6 flex gap-2 rounded-2xl glass p-4">
        <input className="field" placeholder="My cool bot" value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={create} className="btn-solar shrink-0">
          Create app
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-solar-ember">{error}</p>}

      <div className="mt-6 space-y-3">
        {apps.length === 0 && <p className="text-sm text-muted">No apps yet. Create one to get a bot token.</p>}
        {apps.map((a) => (
          <div key={a.id} className="rounded-2xl glass p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-aurora to-solar-glow text-night-900 font-bold">
                {initials(a.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {a.name} <span className="ml-1 rounded bg-aurora/20 px-1.5 text-[10px] font-bold uppercase text-aurora">Bot</span>
                </p>
                <p className="truncate text-xs text-muted">@{a.bot?.username ?? "bot"}</p>
              </div>
              <button onClick={() => del(a.id)} className="text-xs text-muted hover:text-solar-ember">
                Delete
              </button>
            </div>

            <div className="mt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Bot token</p>
              <div className="mt-1 flex items-center gap-2 rounded-lg bg-night-900/60 p-1.5">
                <code className="flex-1 truncate px-2 text-xs text-muted">
                  {revealed[a.id] ? a.token : "•".repeat(28)}
                </code>
                <button onClick={() => setRevealed((r) => ({ ...r, [a.id]: !r[a.id] }))} className="btn-ghost py-1 text-xs">
                  {revealed[a.id] ? "Hide" : "Reveal"}
                </button>
                <button onClick={() => copy(a.token, a.id)} className="btn-ghost py-1 text-xs">
                  {copied === a.id ? "Copied!" : "Copy"}
                </button>
                <button onClick={() => resetToken(a.id)} className="btn-ghost py-1 text-xs">
                  Reset
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-muted">Add to a server you manage:</span>
              <select
                className="field max-w-[200px] py-1.5 text-sm"
                defaultValue=""
                onChange={(e) => {
                  void addToServer(a.id, e.target.value);
                  e.currentTarget.value = "";
                }}
              >
                <option value="">Select server…</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl glass p-5">
        <h2 className="font-bold">Using your bot</h2>
        <p className="mt-1 text-sm text-muted">
          Authenticate API requests with your bot token, then post to any text channel the bot can see:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-night-900/70 p-3 text-xs text-ink/90">
{`curl -X POST ${API_URL}/channels/<channelId>/messages \\
  -H "Authorization: Bot <your-token>" \\
  -H "Content-Type: application/json" \\
  -d '{"content":"Hello from my bot!"}'`}
        </pre>
        <p className="mt-2 text-xs text-muted">The bot must be a member of the server and have permission to send messages.</p>
      </div>
    </main>
  );
}
