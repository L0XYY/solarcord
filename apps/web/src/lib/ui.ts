export function initials(name: string): string {
  return name
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function statusColor(status: string): string {
  switch (status) {
    case "ONLINE":
      return "bg-emerald-400";
    case "IDLE":
      return "bg-amber-400";
    case "DND":
      return "bg-rose-500";
    default:
      return "bg-night-600";
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "ONLINE":
      return "Online";
    case "IDLE":
      return "Idle";
    case "DND":
      return "Do not disturb";
    case "INVISIBLE":
      return "Invisible";
    default:
      return "Offline";
  }
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Today at ${time}` : `${d.toLocaleDateString()} ${time}`;
}

export function displayName(u: { displayName: string | null; username: string }): string {
  return u.displayName ?? u.username;
}

/** Role colour stored as an int (0 = no colour → inherit default text). */
export function colorToHex(color: number): string {
  if (!color) return "#99a1b3"; // muted default
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16) || 0;
}

// Role colour presets — a distinct, non-Discord spectrum so member roles stay
// visually distinct (roles can be any colour even though the app theme is mono).
export const ROLE_SWATCHES = [
  0x3fe0c8, 0x9b6bff, 0xff5fa2, 0x7c6cf6, 0x4ecee2, 0x48d6a4, 0xffb84d, 0xff6b5a, 0xf68ac4, 0x8b93a7,
];
