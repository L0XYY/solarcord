"use client";

export function ServerTag({ tag, badge, className }: { tag: string; badge?: string | null; className?: string }) {
  const isImg = badge && (badge.startsWith("data:") || badge.startsWith("http"));
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md bg-night-700/80 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink ring-1 ring-line/10 ${className ?? ""}`}
    >
      {badge ? (
        isImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={badge} alt="" className="h-3 w-3 rounded-sm" />
        ) : (
          <span className="text-[11px] leading-none">{badge}</span>
        )
      ) : null}
      {tag}
    </span>
  );
}
