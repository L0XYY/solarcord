"use client";
import clsx from "clsx";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

export function VoiceAvatar({
  name,
  src,
  size = 28,
  speaking,
  muted,
  deafened,
}: {
  name: string;
  src?: string | null;
  size?: number;
  speaking?: boolean;
  muted?: boolean;
  deafened?: boolean;
}) {
  return (
    <div className="relative shrink-0" title={name}>
      <Avatar
        name={name}
        src={src}
        size={size}
        className={clsx("transition", speaking && "ring-2 ring-emerald-400 ring-offset-2 ring-offset-night-800")}
      />
      {(muted || deafened) && (
        <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-solar-ember text-night-900 ring-2 ring-night-800">
          <Icon name={deafened ? "headphones" : "mic"} size={9} />
        </span>
      )}
    </div>
  );
}
