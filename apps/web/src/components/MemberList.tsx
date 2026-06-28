"use client";
import clsx from "clsx";
import { initials, statusColor, displayName } from "@/lib/ui";
import type { MemberView } from "@/lib/types";

export function MemberList({ members, onSelectUser }: { members: MemberView[]; onSelectUser?: (userId: string) => void }) {
  const online = members.filter((m) => m.user.status !== "OFFLINE" && m.user.status !== "INVISIBLE");
  const offline = members.filter((m) => m.user.status === "OFFLINE" || m.user.status === "INVISIBLE");

  return (
    <aside className="hidden h-full w-56 flex-col border-l border-line/5 bg-night-800/40 p-3 lg:flex">
      <Section title={`Online — ${online.length}`} members={online} dim={false} onSelectUser={onSelectUser} />
      {offline.length > 0 && <Section title={`Offline — ${offline.length}`} members={offline} dim onSelectUser={onSelectUser} />}
    </aside>
  );
}

function Section({
  title,
  members,
  dim,
  onSelectUser,
}: {
  title: string;
  members: MemberView[];
  dim: boolean;
  onSelectUser?: (userId: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</p>
      <div className="space-y-0.5">
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelectUser?.(m.user.id)}
            className={clsx(
              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-night-700/50",
              dim && "opacity-50",
            )}
          >
            <div className="relative">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-night-600 to-night-700 text-[11px] font-bold">
                {initials(displayName(m.user))}
              </div>
              <span
                className={clsx(
                  "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-night-800",
                  statusColor(m.user.status),
                )}
              />
            </div>
            <span className="truncate text-sm">{m.nickname ?? displayName(m.user)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
