// Account standing — how healthy a member's account is on SolarCord.
// Mirrors the familiar five-tier model: the better your standing, the more
// access you keep. Suspended is terminal until staff lift it.

export type AccountStanding = "ALL_GOOD" | "LIMITED" | "VERY_LIMITED" | "AT_RISK" | "SUSPENDED";

export const ACCOUNT_STANDINGS: AccountStanding[] = ["ALL_GOOD", "LIMITED", "VERY_LIMITED", "AT_RISK", "SUSPENDED"];

export interface AccountStandingInfo {
  /** 0 = best, 4 = suspended. Used to fill the meter. */
  level: number;
  label: string;
  /** One-line summary shown under the meter. */
  summary: string;
  /** What this tier means for the member, in plain language. */
  detail: string;
  /** Hex used for the meter segment + accent. */
  color: string;
}

export const ACCOUNT_STANDING_INFO: Record<AccountStanding, AccountStandingInfo> = {
  ALL_GOOD: {
    level: 0,
    label: "All good",
    summary: "Your account is in good standing.",
    detail: "You're following SolarCord's Community Guidelines. You have full access to every feature.",
    color: "#3ba55d",
  },
  LIMITED: {
    level: 1,
    label: "Limited",
    summary: "You've broken our guidelines a few times.",
    detail: "Some features may be temporarily restricted. Keep things clean and your account will recover on its own.",
    color: "#e8b339",
  },
  VERY_LIMITED: {
    level: 2,
    label: "Very limited",
    summary: "Repeated guideline violations.",
    detail: "More features are restricted while your account recovers. Further violations can put your account at risk.",
    color: "#e8902f",
  },
  AT_RISK: {
    level: 3,
    label: "At risk",
    summary: "Your account is close to being suspended.",
    detail: "One more violation may lead to a permanent suspension. Please review the Community Guidelines carefully.",
    color: "#e0562d",
  },
  SUSPENDED: {
    level: 4,
    label: "Suspended",
    summary: "Your account has been suspended.",
    detail: "You can no longer access SolarCord with this account. If you think this was a mistake, you can submit an appeal.",
    color: "#d83c3c",
  },
};
