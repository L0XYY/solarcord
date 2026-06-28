"use client";

// Built-in SolarCord badge icons (clean SVG recreations of the shared art).
// Keyed by badge key (user badges) or uppercase server badge type.

const ICONS: Record<string, { label: string; svg: React.ReactNode }> = {
  staff: {
    label: "SolarCord Staff",
    svg: (
      <>
        <rect x="2.5" y="2.5" width="19" height="19" rx="7" fill="#e8513a" />
        <text x="12" y="16.6" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff" fontFamily="system-ui">
          S
        </text>
      </>
    ),
  },
  early_supporter: {
    label: "Early Supporter",
    svg: (
      <path
        d="M12 20.5C7 17 3.5 13.8 3.5 9.8 3.5 7.1 5.5 5.2 8 5.2c1.6 0 3 .8 4 2.1 1-1.3 2.4-2.1 4-2.1 2.5 0 4.5 1.9 4.5 4.6 0 4-3.5 7.2-8.5 10.7z"
        fill="#b9a7f5"
      />
    ),
  },
  active_developer: {
    label: "Active Developer",
    svg: (
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
        fill="#f0900f"
      />
    ),
  },
  moderator: {
    label: "Moderator",
    svg: (
      <>
        <path d="M12 2.5l7.5 2.8v5.4c0 4.8-3.2 8.3-7.5 9.3-4.3-1-7.5-4.5-7.5-9.3V5.3L12 2.5z" fill="#4f86c6" />
        <path d="M8.6 12.2l2.2 2.2 4.6-4.8" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  verified: {
    label: "Verified",
    svg: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="7" fill="#3b9eff" />
        <path d="M8.2 12.3l2.4 2.4 5-5.4" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  solar_plus: {
    label: "Solar+",
    svg: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="7" fill="#9b8cff" />
        <path d="M12 7.5v9M7.5 12h9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      </>
    ),
  },
  bug_hunter: {
    label: "Bug Hunter",
    svg: (
      <>
        <circle cx="12" cy="13" r="6" fill="#57c07a" />
        <path d="M12 4v3M6 9l2 1.5M18 9l-2 1.5" stroke="#57c07a" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
};

// Server badge types map onto the same art where it makes sense.
const ALIAS: Record<string, string> = {
  VERIFIED: "verified",
  OFFICIAL_CREATOR: "verified",
  OFFICIAL_BRAND: "verified",
  STAFF_PICK: "staff",
};

export function badgeLabel(key: string): string | undefined {
  return ICONS[ALIAS[key] ?? key]?.label;
}

export function hasBadgeIcon(key: string): boolean {
  return !!ICONS[ALIAS[key] ?? key];
}

export function BadgeIcon({ badge, size = 22, title }: { badge: string; size?: number; title?: string }) {
  const entry = ICONS[ALIAS[badge] ?? badge];
  const label = title ?? entry?.label ?? badge;
  if (!entry) {
    // Fallback: neutral chip with the first letter.
    return (
      <span
        title={label}
        className="grid place-items-center rounded-full bg-night-600 text-[10px] font-bold text-ink"
        style={{ width: size, height: size }}
      >
        {badge[0]?.toUpperCase() ?? "?"}
      </span>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
      <title>{label}</title>
      {entry.svg}
    </svg>
  );
}
