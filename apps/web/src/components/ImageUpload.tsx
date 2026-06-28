"use client";
import { useRef, useState } from "react";
import clsx from "clsx";
import { fileToDataUrl, MAX_UPLOAD_BYTES } from "@/lib/image";

export function ImageUpload({
  value,
  onChange,
  shape = "square",
  maxW,
  maxH,
  format = "image/jpeg",
  label = "Upload",
  className,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  shape?: "square" | "circle" | "wide";
  maxW: number;
  maxH: number;
  format?: "image/jpeg" | "image/png";
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErr("Pick an image file");
    if (file.size > MAX_UPLOAD_BYTES) return setErr("That image is too large (max 8MB)");
    setErr(null);
    setBusy(true);
    try {
      onChange(await fileToDataUrl(file, { maxW, maxH, format }));
    } catch {
      setErr("Couldn't read that image");
    } finally {
      setBusy(false);
    }
  }

  const previewClass =
    shape === "circle" ? "rounded-full" : shape === "wide" ? "rounded-xl aspect-[3/1] w-full" : "rounded-2xl";

  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <div
        className={clsx(
          "grid shrink-0 place-items-center overflow-hidden border border-line/15 bg-night-700",
          previewClass,
          shape === "wide" ? "" : "h-16 w-16",
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-muted">none</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <input ref={inputRef} type="file" accept="image/*" onChange={pick} className="hidden" />
        <button onClick={() => inputRef.current?.click()} disabled={busy} className="btn-ghost py-1.5 text-xs">
          {busy ? "Processing…" : label}
        </button>
        {value && (
          <button onClick={() => onChange(null)} className="text-xs text-muted hover:text-solar-ember">
            Remove
          </button>
        )}
        {err && <span className="text-xs text-solar-ember">{err}</span>}
      </div>
    </div>
  );
}
