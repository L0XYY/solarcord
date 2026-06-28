"use client";

// SolarCord badge icons. Most use the supplied PNG art (served from /badges);
// a few keys without a custom image fall back to a small SVG tile.

function tile(main: string, tint: string) {
  return <rect x="2.5" y="2.5" width="43" height="43" rx="13" fill={tint} stroke={main} strokeWidth="3.5" />;
}

interface IconDef {
  label: string;
  img?: string; // path under /public
  svg?: React.ReactNode;
}

const toolsSvg = (
  <>
    {tile("#5b63e8", "#cfd2fb")}
    <g transform="rotate(45 24 24)">
      <rect x="22.4" y="11" width="3.2" height="13" rx="1.6" fill="#5b63e8" />
      <rect x="22.7" y="24" width="2.6" height="10" rx="1" fill="#5b63e8" />
    </g>
    <g transform="rotate(-45 24 24)">
      <rect x="22.4" y="21" width="3.2" height="15" rx="1.6" fill="#5b63e8" />
      <path d="M17.5 12h13l-2.2 5.5h-8.6z" fill="#5b63e8" />
    </g>
  </>
);

const ICONS: Record<string, IconDef> = {
  staff: { label: "SolarCord Staff", svg: toolsSvg },
  owner: { label: "Owner", img: "/badges/owner.png" },
  early_supporter: { label: "Early Supporter", img: "/badges/booster.png" },
  booster: { label: "Server Booster", img: "/badges/booster.png" },
  bug_hunter: { label: "Bug Hunter", img: "/badges/bughunter.png" },
  community: { label: "Community", img: "/badges/community.png" },
  partner: { label: "Solar Partner", img: "/badges/partner.png" },
  verified: { label: "Verified", img: "/badges/verified.png" },
  verifiedserver: { label: "Verified Server", img: "/badges/verifiedserver.png" },

  // Keys without supplied art — small SVG tiles.
  active_developer: { label: "Active Developer", svg: toolsSvg },
  moderator: {
    label: "Moderator",
    svg: (
      <>
        {tile("#4f86c6", "#cfe0f2")}
        <path d="M24 13l8 3v5.4c0 5-3.4 8.4-8 9.3-4.6-.9-8-4.3-8-9.3V16l8-3Z" fill="#4f86c6" />
        <path d="M20 23.5 23 26.5 28.5 20.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  // Flame, no background tile.
  solar_plus: {
    label: "Solar+",
    svg: (
      <>
        <path
          d="M25 3c-1 6-5.5 8.5-5.5 14.5 0 1.8.5 3.3 1.4 4.4C17.5 20.5 15 17.5 15 13.5c-3 3-5 7.2-5 12.2 0 .6 0 1.1.1 1.6C9.2 26.2 8 23.9 8 20.6c-2.4 3.1-4 6.9-4 11.4C4 41 12 47 24 47s20-6 20-15c0-3.6-1-6.9-2.8-9.6.2 1.5-.3 3-1.2 4 .5-3.9-1.2-7.5-4.2-9.7.6 1.7.4 3.5-.5 4.9C36 16 33 10.6 28 7.5 27.5 6 27 4.4 25 3Z"
          fill="#ff7212"
        />
        <path
          d="M24 22c-3 4.2-5.2 6.8-5.2 11 0 6.2 3.1 11 5.2 12 2.1-1 5.2-5.8 5.2-12 0-4.2-2.2-6.8-5.2-11Z"
          fill="#ffc42e"
        />
        <path
          d="M24 32.5c-1.6 2.2-2.7 3.6-2.7 6 0 3.4 1.5 6 2.7 6.5 1.2-.5 2.7-3.1 2.7-6.5 0-2.4-1.1-3.8-2.7-6Z"
          fill="#ffe79e"
        />
      </>
    ),
  },
};

// Server badge types map onto the badge art.
const ALIAS: Record<string, string> = {
  VERIFIED: "verifiedserver",
  SOLAR_PARTNER: "partner",
  COMMUNITY: "community",
  DISCOVERABLE: "community",
  SAFE_COMMUNITY: "community",
  BOOSTED: "booster",
  OFFICIAL_CREATOR: "verifiedserver",
  OFFICIAL_BRAND: "verifiedserver",
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
  if (entry.img) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={entry.img} alt={label} title={label} width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={label}>
      <title>{label}</title>
      {entry.svg}
    </svg>
  );
}
