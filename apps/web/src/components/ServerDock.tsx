"use client";
import { useState, type MouseEvent as ReactMouseEvent } from "react";
import clsx from "clsx";
import { initials } from "@/lib/ui";
import { api } from "@/lib/api";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { BadgeChip } from "./BadgeChip";
import type { ServerSummary } from "@/lib/types";

interface ServerSummaryData {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  memberCount: number;
  onlineCount: number;
  boostLevel: number;
  isVerified: boolean;
  isPartnered: boolean;
  visibility: string;
  tag: string | null;
  badgeTypes: string[];
}

// Module-level cache so we only fetch a server's summary once per session.
const summaryCache = new Map<string, ServerSummaryData>();

function ServerHoverCard({ summary, fallbackName, anchor }: { summary?: ServerSummaryData; fallbackName: string; anchor: { top: number; left: number } }) {
  const community = summary && (summary.visibility === "COMMUNITY" || summary.visibility === "PUBLIC" || summary.visibility === "DISCOVERABLE");
  const badges = new Set<string>(summary?.badgeTypes ?? []);
  if (summary?.isVerified) badges.add("VERIFIED");
  if (summary?.isPartnered) badges.add("SOLAR_PARTNER");
  if (community) badges.add("COMMUNITY");

  // Fixed to the viewport so the dock's `overflow-y-auto` can't clip it.
  return (
    <div className="pointer-events-none fixed z-[80] w-60 -translate-y-1/2 animate-fade" style={{ top: anchor.top, left: anchor.left }}>
      <div className="rounded-2xl border border-line/10 bg-night-800/95 p-3 shadow-glass backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-night-700 text-xs font-bold">
            {summary?.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={summary.iconUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(summary?.name ?? fallbackName)
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{summary?.name ?? fallbackName}</p>
            {summary && summary.boostLevel > 0 && (
              <p className="flex items-center gap-1 text-[11px] text-pink-400">
                <span className="inline-block h-1.5 w-1.5 rotate-45 rounded-[1px] bg-pink-400" /> Level {summary.boostLevel}
              </p>
            )}
          </div>
        </div>

        {badges.size > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {[...badges].map((b) => (
              <BadgeChip key={b} type={b} />
            ))}
          </div>
        )}

        {summary ? (
          <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> {summary.onlineCount} Online
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted/60" /> {summary.memberCount} Members
            </span>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted">Loading…</p>
        )}
      </div>
    </div>
  );
}

export function ServerDock({
  servers,
  activeId,
  homeActive,
  discoverActive,
  onHome,
  onDiscover,
  onSelect,
  onCreate,
}: {
  servers: ServerSummary[];
  activeId: string | null;
  homeActive: boolean;
  discoverActive: boolean;
  onHome: () => void;
  onDiscover: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <nav className="flex h-full w-[76px] flex-col items-center gap-2 border-r border-line/5 bg-night-900/70 py-3">
      <button onClick={onHome} title="Home" className="group relative">
        <span
          className={clsx(
            "absolute -left-3 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-solar transition-all",
            homeActive ? "h-7" : "h-0 group-hover:h-4",
          )}
        />
        <span
          className={clsx(
            "grid h-12 w-12 place-items-center overflow-hidden rounded-2xl transition-all",
            homeActive ? "rounded-xl ring-2 ring-solar/60" : "hover:rounded-xl",
          )}
        >
          <Logo size={48} />
        </span>
      </button>
      <div className="my-1 h-px w-8 bg-line/10" />

      <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto">
        {servers.map((s) => (
          <ServerDockItem key={s.id} server={s} active={s.id === activeId} onSelect={onSelect} />
        ))}

        <button
          onClick={onCreate}
          title="Create a server"
          className="grid h-12 w-12 place-items-center rounded-2xl bg-night-700 text-emerald-400 transition-all hover:rounded-xl hover:bg-emerald-400/15"
        >
          <Icon name="plus" size={22} />
        </button>

        <button onClick={onDiscover} title="Discover servers" className="group relative">
          <span
            className={clsx(
              "absolute -left-3 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-solar transition-all",
              discoverActive ? "h-7" : "h-0 group-hover:h-4",
            )}
          />
          <span
            className={clsx(
              "grid h-12 w-12 place-items-center rounded-2xl transition-all",
              discoverActive ? "rounded-xl bg-solar/20 text-solar ring-2 ring-solar/50" : "bg-night-700 text-emerald-400 hover:rounded-xl hover:bg-emerald-400/15",
            )}
          >
            <Icon name="compass" size={22} />
          </span>
        </button>
      </div>
    </nav>
  );
}

function ServerDockItem({ server: s, active, onSelect }: { server: ServerSummary; active: boolean; onSelect: (id: string) => void }) {
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [summary, setSummary] = useState<ServerSummaryData | undefined>(summaryCache.get(s.id));

  function onEnter(e: ReactMouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setAnchor({ top: r.top + r.height / 2, left: r.right + 12 });
    if (!summaryCache.has(s.id)) {
      api<{ summary: ServerSummaryData }>(`/servers/${s.id}/summary`)
        .then((r) => {
          summaryCache.set(s.id, r.summary);
          setSummary(r.summary);
        })
        .catch(() => {});
    }
  }

  return (
    <div className="relative" onMouseEnter={onEnter} onMouseLeave={() => setAnchor(null)}>
      <button onClick={() => onSelect(s.id)} className="group relative block">
        <span
          className={clsx(
            "absolute -left-3 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-solar transition-all",
            active ? "h-7" : "h-0 group-hover:h-4",
          )}
        />
        <span
          className={clsx(
            "grid h-12 w-12 place-items-center overflow-hidden rounded-2xl text-sm font-bold transition-all",
            active
              ? "rounded-xl bg-solar/20 text-solar ring-2 ring-solar/50"
              : "bg-night-700 text-ink hover:rounded-xl hover:bg-night-600",
          )}
        >
          {s.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.iconUrl} alt={s.name} className="h-full w-full object-cover" />
          ) : (
            initials(s.name)
          )}
        </span>
      </button>
      {anchor && <ServerHoverCard summary={summary} fallbackName={s.name} anchor={anchor} />}
    </div>
  );
}
