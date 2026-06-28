"use client";
import clsx from "clsx";
import { useVoice, toggleMute, toggleDeafen, leaveVoice } from "@/lib/voice";
import { useAuth } from "@/lib/store";
import { displayName } from "@/lib/ui";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

export function VoiceBar() {
  const v = useVoice();
  const user = useAuth((s) => s.user);
  if (!v.roomId) return null;
  const members = Object.values(v.members);

  return (
    <div className="border-t border-line/5 bg-emerald-500/[0.06] px-2 py-2">
      <div className="flex items-center justify-between px-1">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <Icon name="volume" size={14} /> {v.connecting ? "Connecting…" : "Voice Connected"}
          </p>
          <p className="truncate text-[11px] text-muted">{v.label}</p>
        </div>
        <button
          onClick={() => void leaveVoice()}
          title="Disconnect"
          className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-night-700 hover:text-solar-ember"
        >
          <Icon name="logout" size={15} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 px-1">
        {user && <Dot name={displayName(user)} src={user.avatarUrl} muted={v.muted} />}
        {members.map((m) => (
          <Dot key={m.socketId} name={m.displayName ?? m.username} src={m.avatarUrl} muted={m.muted} />
        ))}
      </div>

      <div className="mt-2 flex gap-1 px-1">
        <button
          onClick={toggleMute}
          className={clsx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium",
            v.muted ? "bg-solar-ember/15 text-solar-ember" : "bg-night-700/60 text-muted hover:text-ink",
          )}
        >
          <Icon name="mic" size={15} /> {v.muted ? "Muted" : "Mute"}
        </button>
        <button
          onClick={toggleDeafen}
          className={clsx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium",
            v.deafened ? "bg-solar-ember/15 text-solar-ember" : "bg-night-700/60 text-muted hover:text-ink",
          )}
        >
          <Icon name="headphones" size={15} /> {v.deafened ? "Deafened" : "Deafen"}
        </button>
      </div>
    </div>
  );
}

function Dot({ name, src, muted }: { name: string; src?: string | null; muted: boolean }) {
  return (
    <div className="relative" title={name}>
      <Avatar name={name} src={src} size={28} />
      {muted && (
        <span className="absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-solar-ember text-night-900">
          <Icon name="mic" size={9} />
        </span>
      )}
    </div>
  );
}
