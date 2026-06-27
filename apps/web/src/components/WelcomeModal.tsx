"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { initials } from "@/lib/ui";

interface Guide {
  name: string;
  description: string | null;
  iconUrl: string | null;
  rules: string[];
  welcomeMessage: string | null;
}

export function WelcomeModal({ serverId, onClose }: { serverId: string; onClose: () => void }) {
  const [guide, setGuide] = useState<Guide | null>(null);

  useEffect(() => {
    api<{ guide: Guide }>(`/servers/${serverId}/guide`).then((r) => setGuide(r.guide));
  }, [serverId]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-night-900/75 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg animate-fade-up overflow-y-auto rounded-2xl glass-strong shadow-glass" onClick={(e) => e.stopPropagation()}>
        <div className="h-24 bg-gradient-to-br from-solar/40 to-aurora/40" />
        <div className="-mt-10 px-6 pb-6">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border-4 border-night-800 bg-gradient-to-br from-aurora to-solar-glow text-xl font-black text-night-900">
            {guide?.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={guide.iconUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(guide?.name ?? "S")
            )}
          </div>
          <h2 className="mt-3 text-2xl font-extrabold">Welcome to {guide?.name ?? "the server"}</h2>
          {guide?.welcomeMessage && <p className="mt-2 whitespace-pre-wrap text-sm text-ink/90">{guide.welcomeMessage}</p>}
          {guide?.description && !guide.welcomeMessage && <p className="mt-2 text-sm text-muted">{guide.description}</p>}

          {guide && guide.rules.length > 0 && (
            <div className="mt-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Server rules</p>
              <ol className="mt-2 space-y-2">
                {guide.rules.map((r, i) => (
                  <li key={i} className="flex gap-3 rounded-xl bg-night-900/40 p-3 text-sm">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-solar/20 text-xs font-bold text-solar">{i + 1}</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <button onClick={onClose} className="btn-solar mt-6 w-full">
            Let&apos;s go
          </button>
        </div>
      </div>
    </div>
  );
}
