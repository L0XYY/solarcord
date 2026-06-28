"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { statusColor, statusLabel } from "@/lib/ui";
import { Avatar } from "./Avatar";

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

export function ProfileCard({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [p, setP] = useState<Profile | null>(null);

  useEffect(() => {
    api<{ profile: Profile }>(`/users/${userId}`).then((r) => setP(r.profile));
  }, [userId]);

  const name = p?.displayName ?? p?.username ?? "";

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-night-900/70 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm animate-fade-up overflow-hidden rounded-2xl glass-strong shadow-glass" onClick={(e) => e.stopPropagation()}>
        <div className="h-20 bg-night-700" style={p?.bannerUrl ? { backgroundImage: `url(${p.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
        <div className="px-5 pb-5">
          <div className="-mt-9 flex items-end justify-between">
            <div className="relative">
              <div className="rounded-2xl border-4 border-night-800">
                <Avatar name={name || "?"} src={p?.avatarUrl} size={56} rounded="xl" />
              </div>
              {p && (
                <span className={clsx("absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-4 border-night-800", statusColor(p.status))} title={statusLabel(p.status)} />
              )}
            </div>
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

          {p && p.badges.length > 0 && (
            <div className="mt-4 border-t border-line/10 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Badges</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.badges.map((b) => (
                  <span key={b.key} className="rounded-full bg-night-700/70 px-2.5 py-1 text-xs" title={b.name}>
                    {b.name}
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
