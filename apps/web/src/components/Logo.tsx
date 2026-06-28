"use client";

// SolarCord logo — a friendly planet (smiley + Saturn ring) over a chat bubble.
// `square` wraps it in the glassy black app-icon tile; otherwise it's the bare mark.
export function Logo({ size = 40, square = true, className }: { size?: number; square?: boolean; className?: string }) {
  const mark = (
    <g>
      {/* chat-bubble tail */}
      <path d="M17 30 L12.5 37.5 L21.5 33.5 Z" fill="#fff" />
      {/* Saturn ring (drawn behind the planet) */}
      <ellipse cx="24" cy="24" rx="18.5" ry="7" transform="rotate(-20 24 24)" fill="none" stroke="#fff" strokeWidth="2.6" />
      {/* planet / head */}
      <circle cx="24" cy="22" r="11" fill="#fff" />
      {/* re-draw the front of the ring over the planet's lower edge for the wrap effect */}
      <path d="M11 28.5 A18.5 7 -20 0 0 36.5 31.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      {/* eyes */}
      <circle cx="20.2" cy="20.4" r="1.7" fill="#141418" />
      <circle cx="27.8" cy="20.4" r="1.7" fill="#141418" />
      {/* smile */}
      <path d="M20 24.6 Q24 28.4 28 24.6" fill="none" stroke="#141418" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  );

  if (!square) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" className={className} role="img" aria-label="SolarCord">
        {mark}
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} role="img" aria-label="SolarCord">
      <defs>
        <linearGradient id="scLogoTile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1b20" />
          <stop offset="1" stopColor="#060608" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="45" height="45" rx="12" fill="url(#scLogoTile)" stroke="#fff" strokeOpacity="0.18" />
      {mark}
    </svg>
  );
}
