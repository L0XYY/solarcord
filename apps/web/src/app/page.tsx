"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { bootstrapSession } from "@/lib/api";

export default function Landing() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    bootstrapSession().then((ok) => {
      if (ok) router.replace("/app");
      else setChecked(true);
    });
  }, [router]);

  if (!checked) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-solar/30 border-t-solar" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-28 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-muted">
          <span className="h-2 w-2 rounded-full bg-solar shadow-glow" /> Now in early access
        </div>
        <h1 className="text-balance text-5xl font-extrabold tracking-tight sm:text-7xl">
          Your community, <span className="solar-text">brought to light.</span>
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-lg text-muted">
          SolarCord is a fast, modern home for your servers, channels, voice rooms and friends —
          wrapped in a warm, glassy solar aesthetic.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="btn-solar px-6 py-3 text-base">
            Create your account
          </Link>
          <Link href="/login" className="btn-ghost px-6 py-3 text-base">
            Log in
          </Link>
        </div>

        <div className="mt-20 grid w-full gap-4 sm:grid-cols-3">
          {[
            ["Real-time everything", "Messages, presence and typing over a fast WebSocket gateway."],
            ["Powerful roles", "A 64-bit permission system with per-channel overrides."],
            ["Built to grow", "Servers, discovery, voice and Solar+ — phase by phase."],
          ].map(([title, body]) => (
            <div key={title} className="glass rounded-2xl p-5 text-left">
              <div className="mb-2 h-9 w-9 rounded-xl bg-gradient-to-br from-solar to-solar-glow shadow-glow" />
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
