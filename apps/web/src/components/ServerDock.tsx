"use client";
import clsx from "clsx";
import { initials } from "@/lib/ui";
import { Icon } from "./Icon";
import type { ServerSummary } from "@/lib/types";

export function ServerDock({
  servers,
  activeId,
  homeActive,
  discoverActive,
  onHome,
  onDiscover,
  onSelect,
  onCreate,
}: {
  servers: ServerSummary[];
  activeId: string | null;
  homeActive: boolean;
  discoverActive: boolean;
  onHome: () => void;
  onDiscover: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <nav className="flex h-full w-[76px] flex-col items-center gap-2 border-r border-line/5 bg-night-900/70 py-3">
      <button onClick={onHome} title="Home" className="group relative">
        <span
          className={clsx(
            "absolute -left-3 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-solar transition-all",
            homeActive ? "h-7" : "h-0 group-hover:h-4",
          )}
        />
        <span
          className={clsx(
            "grid h-12 w-12 place-items-center rounded-2xl text-night-900 shadow-glow transition-all",
            homeActive ? "rounded-xl ring-2 ring-solar/50" : "hover:rounded-xl",
            "bg-gradient-to-br from-solar to-solar-glow",
          )}
        >
          <span className="text-lg font-black">S</span>
        </span>
      </button>
      <div className="my-1 h-px w-8 bg-line/10" />

      <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto">
        {servers.map((s) => {
          const active = s.id === activeId;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              title={s.name}
              className="group relative"
            >
              <span
                className={clsx(
                  "absolute -left-3 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-solar transition-all",
                  active ? "h-7" : "h-0 group-hover:h-4",
                )}
              />
              <span
                className={clsx(
                  "grid h-12 w-12 place-items-center overflow-hidden rounded-2xl text-sm font-bold transition-all",
                  active
                    ? "rounded-xl bg-solar/20 text-solar ring-2 ring-solar/50"
                    : "bg-night-700 text-ink hover:rounded-xl hover:bg-night-600",
                )}
              >
                {s.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.iconUrl} alt={s.name} className="h-full w-full object-cover" />
                ) : (
                  initials(s.name)
                )}
              </span>
            </button>
          );
        })}

        <button
          onClick={onCreate}
          title="Create a server"
          className="grid h-12 w-12 place-items-center rounded-2xl bg-night-700 text-emerald-400 transition-all hover:rounded-xl hover:bg-emerald-400/15"
        >
          <Icon name="plus" size={22} />
        </button>

        <button onClick={onDiscover} title="Discover servers" className="group relative">
          <span
            className={clsx(
              "absolute -left-3 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-solar transition-all",
              discoverActive ? "h-7" : "h-0 group-hover:h-4",
            )}
          />
          <span
            className={clsx(
              "grid h-12 w-12 place-items-center rounded-2xl transition-all",
              discoverActive ? "rounded-xl bg-solar/20 text-solar ring-2 ring-solar/50" : "bg-night-700 text-emerald-400 hover:rounded-xl hover:bg-emerald-400/15",
            )}
          >
            <Icon name="compass" size={22} />
          </span>
        </button>
      </div>
    </nav>
  );
}
