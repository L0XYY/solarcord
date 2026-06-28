"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { statusColor, statusLabel, colorToHex } from "@/lib/ui";
import { Avatar } from "./Avatar";
import { BadgeIcon } from "./BadgeIcon";

export interface ProfileRole {
  id: string;
  name: string;
  color: number;
  iconUrl: string | null;
}

interface Profile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  pronouns: string | null;
  status: string;
  isBot: boolean;
  isStaff: boolean;
  badges: { key: string; name: string; iconUrl: string | null }[];
}

export function ProfileCard({ userId, roles, onClose }: { userId: string; roles?: ProfileRole[]; onClose: () => void }) {
  const [p, setP] = useState<Profile | null>(null);

  useEffect(() => {
    api<{ profile: Profile }>(`/users/${userId}`).then((r) => setP(r.profile));
  }, [userId]);

  const name = p?.displayName ?? p?.username ?? "";

  return (
    <div className="animate-fade fixed inset-0 z-[60] grid place-items-center bg-night-900/70 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm animate-pop overflow-hidden rounded-2xl glass-strong shadow-glass" onClick={(e) => e.stopPropagation()}>
        <div className="h-20 bg-night-700" style={p?.bannerUrl ? { backgroundImage: `url(${p.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
        <div className="px-5 pb-5">
          <div className="-mt-9 flex items-end justify-between gap-2">
            <div className="relative">
              <div className="rounded-2xl border-4 border-night-800">
                <Avatar name={name || "?"} src={p?.avatarUrl} size={56} rounded="xl" />
              </div>
              {p && (
                <span className={clsx("absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-4 border-night-800", statusColor(p.status))} title={statusLabel(p.status)} />
              )}
            </div>

            {/* Discord-style badge row, top-right next to the avatar. */}
            {p && (p.badges.length > 0 || p.isStaff) && (
              <div className="mb-1 flex flex-wrap items-center justify-end gap-1.5 rounded-xl border border-line/10 bg-night-900/60 px-2 py-1.5">
                {p.isStaff && !p.badges.some((b) => b.key === "staff") && <BadgeIcon badge="staff" size={22} />}
                {p.badges.map((b) =>
                  b.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={b.key} src={b.iconUrl} alt={b.name} title={b.name} className="h-[22px] w-[22px] rounded" />
                  ) : (
                    <BadgeIcon key={b.key} badge={b.key} size={22} title={b.name} />
                  ),
                )}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <h2 className="text-lg font-bold">{name}</h2>
            {p?.isBot && <span className="rounded bg-aurora/20 px-1.5 text-[10px] font-bold uppercase text-aurora">Bot</span>}
            {p?.isStaff && <span className="rounded bg-line/15 px-1.5 text-[10px] font-bold uppercase text-ink">Staff</span>}
          </div>
          <p className="text-sm text-muted">
            @{p?.username}
            {p?.pronouns ? ` · ${p.pronouns}` : ""}
          </p>

          {p?.bio && (
            <div className="mt-4 border-t border-line/10 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">About me</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{p.bio}</p>
            </div>
          )}

          {roles && roles.length > 0 && (
            <div className="mt-4 border-t border-line/10 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Roles</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {roles.map((r) => (
                  <span
                    key={r.id}
                    className="flex items-center gap-1.5 rounded-md border border-line/10 bg-night-700/60 px-2 py-1 text-xs"
                    style={{ color: colorToHex(r.color) }}
                  >
                    {r.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.iconUrl} alt="" className="h-3 w-3 rounded" />
                    ) : (
                      <span className="h-2 w-2 rounded-full" style={{ background: colorToHex(r.color) }} />
                    )}
                    {r.name}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
