// SolarCord original server badge definitions. Icons are emoji placeholders —
// swap for custom SVGs later. None reference Discord assets.

export type ServerBadgeType =
  | "COMMUNITY"
  | "DISCOVERABLE"
  | "SOLAR_PARTNER"
  | "VERIFIED"
  | "OFFICIAL_CREATOR"
  | "OFFICIAL_BRAND"
  | "STAFF_PICK"
  | "BOOSTED"
  | "SAFE_COMMUNITY";

export interface ServerBadgeInfo {
  label: string;
  icon: string;
  description: string;
}

export const SERVER_BADGE_INFO: Record<ServerBadgeType, ServerBadgeInfo> = {
  VERIFIED: {
    label: "Verified",
    icon: "☀",
    description: "An official brand, creator, game, public figure, company or organisation.",
  },
  SOLAR_PARTNER: {
    label: "Solar Partner",
    icon: "🤝",
    description: "A high-quality, active community recognised by SolarCord.",
  },
  COMMUNITY: {
    label: "Community Server",
    icon: "🌐",
    description: "A public community with rules screening and moderation tools enabled.",
  },
  DISCOVERABLE: {
    label: "Discoverable",
    icon: "🧭",
    description: "Listed in Server Discovery for anyone to find and join.",
  },
  OFFICIAL_CREATOR: {
    label: "Official Creator",
    icon: "🎨",
    description: "The official server of a verified creator.",
  },
  OFFICIAL_BRAND: {
    label: "Official Brand",
    icon: "🏷",
    description: "The official server of a verified brand or company.",
  },
  STAFF_PICK: {
    label: "Staff Pick",
    icon: "⭐",
    description: "Hand-picked by the SolarCord team.",
  },
  BOOSTED: {
    label: "Boosted",
    icon: "🚀",
    description: "Powered up by member boosts for extra perks.",
  },
  SAFE_COMMUNITY: {
    label: "Safe Community",
    icon: "🛡",
    description: "Meets SolarCord's safety and moderation standards.",
  },
};
