"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { DISCOVERY_CATEGORIES } from "@solarcord/shared";
import { api } from "@/lib/api";
import { initials } from "@/lib/ui";
import { BadgeRow } from "./BadgeChip";
import { ServerTag } from "./ServerTag";
import type { DiscoveryServer } from "@/lib/types";

export function DiscoveryPage({ onJoined }: { onJoined: (serverId: string) => void }) {
  const [servers, setServers] = useState<DiscoveryServer[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    const t = setTimeout(() => {
      api<{ servers: DiscoveryServer[] }>(`/discovery?${params.toString()}`)
        .then((r) => setServers(r.servers))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, category]);

  async function join(id: string) {
    setJoining(id);
    try {
      await api(`/discovery/${id}/join`, { method: "POST" });
      onJoined(id);
    } finally {
      setJoining(null);
    }
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-night-900/30">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-line/5 px-8 py-10">
        <div className="absolute inset-0 bg-gradient-to-br from-solar/15 via-transparent to-aurora/15" />
        <div className="relative">
          <h1 className="text-3xl font-extrabold">
            Discover <span className="solar-text">communities</span>
          </h1>
          <p className="mt-1 text-muted">Find public servers to join, from gaming to art to code.</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search servers…"
            className="field mt-5 max-w-lg"
          />
        </div>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 border-b border-line/5 px-8 py-3">
        <Chip active={category === null} onClick={() => setCategory(null)}>
          All
        </Chip>
        {DISCOVERY_CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : servers.length === 0 ? (
          <p className="text-sm text-muted">No servers found. Try another search or category.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {servers.map((s) => (
              <div key={s.id} className="overflow-hidden rounded-2xl glass shadow-glass transition hover:border-line/20">
                <div className="h-20 bg-gradient-to-br from-solar/40 to-aurora/40">
                  {s.bannerUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.bannerUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="-mt-7 px-4 pb-4">
                  <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border-4 border-night-800 bg-gradient-to-br from-aurora to-solar-glow text-lg font-black text-night-900">
                    {s.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.iconUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials(s.name)
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <h3 className="truncate font-bold">{s.name}</h3>
                    {s.tag && <ServerTag tag={s.tag} badge={s.tagBadge} />}
                    <BadgeRow types={s.badges} />
                  </div>
                  <p className="mt-1 line-clamp-2 h-10 text-sm text-muted">{s.description || "No description provided."}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      {s.memberCount} members
                    </span>
                    <button onClick={() => join(s.id)} disabled={joining === s.id} className="btn-solar px-4 py-1.5 text-xs">
                      {joining === s.id ? "Joining…" : "Join"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
        active ? "bg-gradient-to-r from-solar to-solar-glow text-night-900" : "bg-night-700/60 text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
