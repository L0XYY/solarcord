"use client";
import { useEffect, useState, type CSSProperties } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { statusColor, statusLabel, colorToHex } from "@/lib/ui";
import { Avatar } from "./Avatar";
import { BadgeIcon } from "./BadgeIcon";
import { ServerTag } from "./ServerTag";

export interface ProfileRole {
  id: string;
  name: string;
  color: number;
  iconUrl: string | null;
}

export interface ProfileViewData {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  pronouns: string | null;
  status: string;
  customStatus?: string | null;
  isBot?: boolean;
  isStaff?: boolean;
  themePrimary?: string | null;
  themeAccent?: string | null;
  tag?: string | null;
  tagBadge?: string | null;
  badges?: { key: string; name: string; iconUrl: string | null }[];
}

// Pick a readable text colour for an arbitrary theme background.
function readableOn(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#15151a" : "#f5f5f7";
}

export function ProfileCardView({ data, roles }: { data: ProfileViewData; roles?: ProfileRole[] }) {
  const name = data.displayName ?? data.username;
  const primary = data.themePrimary ?? null;
  const accent = data.themeAccent ?? null;
  const themed = !!primary;
  const text = primary ? readableOn(primary) : undefined;
  const muted = primary ? (text === "#15151a" ? "rgba(0,0,0,.55)" : "rgba(255,255,255,.65)") : undefined;
  const divider = primary ? (text === "#15151a" ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.15)") : undefined;

  const bodyStyle: CSSProperties = themed ? { background: primary!, color: text } : {};
  const bannerStyle: CSSProperties = data.bannerUrl
    ? { backgroundImage: `url(${data.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : primary
      ? { background: `linear-gradient(120deg, ${accent ?? primary}, ${primary})` }
      : {};

  return (
    <div className={clsx("overflow-hidden rounded-2xl", !themed && "glass-strong")} style={bodyStyle}>
      <div className="h-20" style={bannerStyle}>
        {!data.bannerUrl && !primary && <div className="h-full w-full bg-night-700" />}
      </div>
      <div className="px-4 pb-4">
        <div className="-mt-9 flex items-end justify-between gap-2">
          <div className="relative">
            <div className="rounded-2xl border-4" style={{ borderColor: themed ? primary! : "rgb(var(--night-800))" }}>
              <Avatar name={name} src={data.avatarUrl} size={56} rounded="xl" />
            </div>
            <span
              className={clsx("absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-4", statusColor(data.status))}
              style={{ borderColor: themed ? primary! : "rgb(var(--night-800))" }}
              title={statusLabel(data.status)}
            />
          </div>

          {(data.badges?.length || data.isStaff) && (
            <div
              className="mb-1 flex flex-wrap items-center justify-end gap-1 rounded-xl px-2 py-1"
              style={{ background: themed ? "rgba(0,0,0,.15)" : "rgb(var(--night-900) / 0.6)" }}
            >
              {data.isStaff && !data.badges?.some((b) => b.key === "staff") && <BadgeIcon badge="staff" size={18} />}
              {data.badges?.map((b) =>
                b.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={b.key} src={b.iconUrl} alt={b.name} title={b.name} className="h-[18px] w-[18px] rounded" />
                ) : (
                  <BadgeIcon key={b.key} badge={b.key} size={18} title={b.name} />
                ),
              )}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <h2 className="text-lg font-bold" style={accent ? { color: accent } : undefined}>
            {name}
          </h2>
          {data.tag && <ServerTag tag={data.tag} badge={data.tagBadge} />}
          {data.isBot && <span className="rounded bg-aurora/20 px-1.5 text-[10px] font-bold uppercase text-aurora">Bot</span>}
        </div>
        <p className="text-sm" style={{ color: muted }}>
          @{data.username}
          {data.pronouns ? ` · ${data.pronouns}` : ""}
        </p>

        {data.bio && (
          <div className="mt-4 border-t pt-3" style={{ borderColor: divider ?? "rgb(var(--line) / 0.1)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: muted }}>
              About me
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{data.bio}</p>
          </div>
        )}

        {roles && roles.length > 0 && (
          <div className="mt-4 border-t pt-3" style={{ borderColor: divider ?? "rgb(var(--line) / 0.1)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: muted }}>
              Roles
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <span
                  key={r.id}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
                  style={{ color: colorToHex(r.color), background: themed ? "rgba(0,0,0,.12)" : "rgb(var(--night-700) / 0.6)" }}
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

        {accent && (
          <button
            className="mt-4 w-full rounded-lg py-2 text-sm font-semibold"
            style={{ background: accent, color: readableOn(accent) }}
          >
            Message
          </button>
        )}
      </div>
    </div>
  );
}

interface FetchedProfile extends ProfileViewData {
  id: string;
}

export function ProfileCard({ userId, roles, onClose }: { userId: string; roles?: ProfileRole[]; onClose: () => void }) {
  const [p, setP] = useState<FetchedProfile | null>(null);

  useEffect(() => {
    api<{ profile: FetchedProfile }>(`/users/${userId}`).then((r) => setP(r.profile));
  }, [userId]);

  return (
    <div className="animate-fade fixed inset-0 z-[60] grid place-items-center bg-night-900/70 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm animate-pop shadow-glass" onClick={(e) => e.stopPropagation()}>
        {p ? (
          <ProfileCardView data={p} roles={roles} />
        ) : (
          <div className="grid h-48 place-items-center rounded-2xl glass-strong">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-solar/30 border-t-solar" />
          </div>
        )}
      </div>
    </div>
  );
}
