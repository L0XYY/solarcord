"use client";
import clsx from "clsx";
import { useVoice, toggleMute, toggleDeafen, leaveVoice, toggleCamera, toggleScreenShare } from "@/lib/voice";
import { useAuth } from "@/lib/store";
import { displayName } from "@/lib/ui";
import { Icon } from "./Icon";
import { VoiceAvatar } from "./VoiceAvatar";

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

      <div className="mt-2 flex flex-wrap gap-2 px-1">
        {user && (
          <VoiceAvatar name={displayName(user)} src={user.avatarUrl} muted={v.muted} deafened={v.deafened} speaking={v.selfSpeaking} />
        )}
        {members.map((m) => (
          <VoiceAvatar
            key={m.socketId}
            name={m.displayName ?? m.username}
            src={m.avatarUrl}
            muted={m.muted}
            deafened={m.deafened}
            speaking={m.speaking}
          />
        ))}
      </div>

      <div className="mt-2 flex gap-1 px-1">
        <Ctl active={v.muted} danger onClick={toggleMute} icon="mic" title={v.muted ? "Unmute" : "Mute"} />
        <Ctl active={v.deafened} danger onClick={toggleDeafen} icon="headphones" title={v.deafened ? "Undeafen" : "Deafen"} />
        <Ctl active={v.cameraOn} onClick={toggleCamera} icon="video" title={v.cameraOn ? "Stop camera" : "Camera"} />
        <Ctl active={v.screenOn} onClick={toggleScreenShare} icon="monitor" title={v.screenOn ? "Stop sharing" : "Share screen"} />
      </div>
    </div>
  );
}

function Ctl({
  active,
  danger,
  onClick,
  icon,
  title,
}: {
  active: boolean;
  danger?: boolean;
  onClick: () => void;
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        "grid h-8 flex-1 place-items-center rounded-lg transition",
        active
          ? danger
            ? "bg-solar-ember/15 text-solar-ember"
            : "bg-emerald-500/15 text-emerald-400"
          : "bg-night-700/60 text-muted hover:text-ink",
      )}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

