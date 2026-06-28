"use client";
import clsx from "clsx";
import { initials } from "@/lib/ui";

export function Avatar({
  name,
  src,
  size = 36,
  rounded = "full",
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  rounded?: "full" | "xl";
  className?: string;
}) {
  const radius = rounded === "full" ? "rounded-full" : "rounded-2xl";
  return (
    <div
      className={clsx("grid shrink-0 place-items-center overflow-hidden bg-night-600 font-semibold text-ink", radius, className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials(name || "?")
      )}
    </div>
  );
}
