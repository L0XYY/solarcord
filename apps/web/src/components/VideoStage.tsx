"use client";
import { useEffect, useRef } from "react";
import { useVoice, getLocalVideo, getRemoteVideo } from "@/lib/voice";

export function VideoStage() {
  const v = useVoice();
  // videoTick in the store forces a re-render when streams change.
  void v.videoTick;
  if (!v.roomId) return null;

  const tiles: { key: string; label: string; stream: MediaStream | null; me?: boolean }[] = [];
  if (v.cameraOn || v.screenOn) tiles.push({ key: "self", label: "You", stream: getLocalVideo(), me: true });
  for (const m of Object.values(v.members)) {
    const s = getRemoteVideo(m.socketId);
    if (s) tiles.push({ key: m.socketId, label: m.displayName ?? m.username, stream: s });
  }
  if (tiles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-40 w-full max-w-3xl -translate-x-1/2 px-4">
      <div className="pointer-events-auto grid gap-2 rounded-2xl glass-strong p-2 shadow-glass sm:grid-cols-2">
        {tiles.map((t) => (
          <Tile key={t.key} stream={t.stream} label={t.label} me={t.me} />
        ))}
      </div>
    </div>
  );
}

function Tile({ stream, label, me }: { stream: MediaStream | null; label: string; me?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-night-900">
      <video ref={ref} autoPlay playsInline muted={me} className="h-full w-full object-cover" />
      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-night-900/70 px-2 py-0.5 text-xs font-medium text-ink">
        {label}
        {me ? " (you)" : ""}
      </span>
    </div>
  );
}
