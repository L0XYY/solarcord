"use client";
import clsx from "clsx";
import { statusColor, displayName, colorToHex } from "@/lib/ui";
import { Avatar } from "./Avatar";
import { ServerTag } from "./ServerTag";
import type { MemberView, Role } from "@/lib/types";

const DEFAULT_COLOR = 0; // roles with no custom colour

// The member's highest-positioned role that has a custom colour — drives name colour.
function colourRole(member: MemberView, byId: Map<string, Role>): Role | null {
  let best: Role | null = null;
  for (const id of member.roleIds ?? []) {
    const r = byId.get(id);
    if (!r || r.isEveryone || r.color === DEFAULT_COLOR) continue;
    if (!best || r.position > best.position) best = r;
  }
  return best;
}

// The member's highest hoisted role — drives which group they sit in.
function hoistRole(member: MemberView, byId: Map<string, Role>): Role | null {
  let best: Role | null = null;
  for (const id of member.roleIds ?? []) {
    const r = byId.get(id);
    if (!r || r.isEveryone || !r.isHoisted) continue;
    if (!best || r.position > best.position) best = r;
  }
  return best;
}

export function MemberList({
  members,
  roles = [],
  onSelectUser,
}: {
  members: MemberView[];
  roles?: Role[];
  onSelectUser?: (userId: string) => void;
}) {
  const byId = new Map(roles.map((r) => [r.id, r]));
  const isOnline = (m: MemberView) => m.user.status !== "OFFLINE" && m.user.status !== "INVISIBLE";

  // Online members are grouped under their highest hoisted role (Discord-style);
  // everyone hoisted-roleless falls into "Online". Offline is its own group.
  const hoisted = roles.filter((r) => r.isHoisted && !r.isEveryone).sort((a, b) => b.position - a.position);

  const groups: { key: string; title: string; color?: string; members: MemberView[]; dim: boolean }[] = [];
  const onlineMembers = members.filter(isOnline);
  const claimed = new Set<string>();

  for (const role of hoisted) {
    const inRole = onlineMembers.filter((m) => !claimed.has(m.id) && hoistRole(m, byId)?.id === role.id);
    inRole.forEach((m) => claimed.add(m.id));
    if (inRole.length) groups.push({ key: role.id, title: role.name, color: colorToHex(role.color), members: inRole, dim: false });
  }
  const restOnline = onlineMembers.filter((m) => !claimed.has(m.id));
  if (restOnline.length) groups.push({ key: "online", title: "Online", members: restOnline, dim: false });

  const offline = members.filter((m) => !isOnline(m));
  if (offline.length) groups.push({ key: "offline", title: "Offline", members: offline, dim: true });

  return (
    <aside className="hidden h-full w-56 flex-col overflow-y-auto border-l border-line/5 bg-night-800/40 p-3 lg:flex">
      {groups.map((g) => (
        <div key={g.key} className="mb-4">
          <p
            className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: g.color ?? "rgb(var(--muted))" }}
          >
            {g.title} — {g.members.length}
          </p>
          <div className="space-y-0.5">
            {g.members.map((m) => {
              const cr = colourRole(m, byId);
              const nameColor = cr ? colorToHex(cr.color) : undefined;
              const topRole = hoistRole(m, byId) ?? cr;
              return (
                <button
                  key={m.id}
                  onClick={() => onSelectUser?.(m.user.id)}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-night-700/50",
                    g.dim && "opacity-50",
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar name={displayName(m.user)} src={m.user.avatarUrl} size={32} />
                    <span
                      className={clsx(
                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-night-800",
                        statusColor(m.user.status),
                      )}
                    />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm" style={nameColor ? { color: nameColor } : undefined}>
                        {m.nickname ?? displayName(m.user)}
                      </span>
                      {m.user.tag && <ServerTag tag={m.user.tag} badge={m.user.tagBadge} />}
                    </span>
                    {topRole && (
                      <span className="flex items-center gap-1 text-[10px] text-muted">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: colorToHex(topRole.color) }} />
                        {topRole.name}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}
