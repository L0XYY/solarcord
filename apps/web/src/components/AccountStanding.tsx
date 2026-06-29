"use client";
import clsx from "clsx";
import { ACCOUNT_STANDINGS, ACCOUNT_STANDING_INFO, type AccountStanding } from "@solarcord/shared";

export function AccountStandingPanel({ standing, reason }: { standing?: string | null; reason?: string | null }) {
  const current = (ACCOUNT_STANDINGS.includes(standing as AccountStanding) ? standing : "ALL_GOOD") as AccountStanding;
  const info = ACCOUNT_STANDING_INFO[current];
  // The meter "fills" from All good (left) toward Suspended (right). The further
  // right the marker, the worse the standing.
  const markerPct = [10, 30, 50, 70, 92][info.level];

  return (
    <div className="p-6">
      <h3 className="text-lg font-extrabold">Account Standing</h3>
      <p className="mt-1 text-sm text-muted">
        See how your account is doing and whether any features are limited. Standing improves over time when you follow the
        Community Guidelines.
      </p>

      {/* Hero status card */}
      <div className="mt-5 overflow-hidden rounded-2xl glass">
        <div className="h-1.5 w-full" style={{ background: info.color }} />
        <div className="flex items-start gap-4 p-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: `${info.color}22` }}>
            <StandingGlyph level={info.level} color={info.color} />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold" style={{ color: info.color }}>
              {info.label}
            </p>
            <p className="mt-0.5 text-sm text-muted">{info.summary}</p>
          </div>
        </div>

        {/* Meter */}
        <div className="px-5 pb-6">
          <div className="relative h-2.5 rounded-full bg-night-700/70">
            <div className="flex h-full overflow-hidden rounded-full">
              {ACCOUNT_STANDINGS.map((s, i) => (
                <span
                  key={s}
                  className="h-full flex-1"
                  style={{
                    background: i <= info.level ? ACCOUNT_STANDING_INFO[s].color : "transparent",
                    opacity: i <= info.level ? 1 : 0,
                    borderRight: i < 4 ? "2px solid rgb(var(--night-800))" : "none",
                  }}
                />
              ))}
            </div>
            <span
              className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] shadow-lg"
              style={{ left: `${markerPct}%`, background: info.color, borderColor: "rgb(var(--night-800))" }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-muted">
            <span>All good</span>
            <span>Suspended</span>
          </div>
        </div>
      </div>

      {reason && (
        <div className="mt-4 rounded-2xl border border-line/10 bg-night-900/40 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">A note from the SolarCord team</p>
          <p className="mt-1 text-sm">{reason}</p>
        </div>
      )}

      {/* What each level means */}
      <p className="mt-7 text-[11px] font-bold uppercase tracking-wider text-muted">What the levels mean</p>
      <div className="mt-3 space-y-2">
        {ACCOUNT_STANDINGS.map((s) => {
          const li = ACCOUNT_STANDING_INFO[s];
          const active = s === current;
          return (
            <div
              key={s}
              className={clsx(
                "flex items-start gap-3 rounded-xl border p-3 transition",
                active ? "border-line/25 bg-line/[0.06]" : "border-line/10 opacity-70",
              )}
            >
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: li.color }} />
              <div>
                <p className="text-sm font-semibold" style={active ? { color: li.color } : undefined}>
                  {li.label}
                  {active && <span className="ml-2 rounded-full bg-line/10 px-2 py-0.5 text-[10px] font-bold text-muted">You're here</span>}
                </p>
                <p className="mt-0.5 text-xs text-muted">{li.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {current === "SUSPENDED" && (
        <button className="btn-solar mt-5 text-sm">Submit an appeal</button>
      )}
    </div>
  );
}

// A tiny shield-style glyph that reflects severity (check → warning → cross).
function StandingGlyph({ level, color }: { level: number; color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3Z" />
      {level === 0 && <path d="M9 12l2 2 4-4" />}
      {level >= 1 && level <= 2 && <path d="M12 8v4M12 16h.01" />}
      {level >= 3 && <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />}
    </svg>
  );
}
