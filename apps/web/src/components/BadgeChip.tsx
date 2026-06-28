"use client";
import { SERVER_BADGE_INFO, type ServerBadgeType } from "@solarcord/shared";
import { BadgeIcon, hasBadgeIcon } from "./BadgeIcon";

export function BadgeChip({ type, size = "sm" }: { type: string; size?: "sm" | "md" }) {
  const info = SERVER_BADGE_INFO[type as ServerBadgeType];
  if (!info) return null;
  const px = size === "md" ? 24 : 20;

  // Use the crisp SVG icon when we have one (e.g. the verified check), else the emoji chip.
  if (hasBadgeIcon(type)) {
    return (
      <span title={`${info.label} — ${info.description}`} className="inline-flex shrink-0">
        <BadgeIcon badge={type} size={px} title={`${info.label} — ${info.description}`} />
      </span>
    );
  }

  const dim = size === "md" ? "h-6 w-6 text-sm" : "h-5 w-5 text-xs";
  return (
    <span
      title={`${info.label} — ${info.description}`}
      className={`grid ${dim} shrink-0 place-items-center rounded-full bg-night-700/80 ring-1 ring-line/10`}
    >
      {info.icon}
    </span>
  );
}

export function BadgeRow({ types, size }: { types: string[]; size?: "sm" | "md" }) {
  if (!types.length) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {types.map((t) => (
        <BadgeChip key={t} type={t} size={size} />
      ))}
    </span>
  );
}
