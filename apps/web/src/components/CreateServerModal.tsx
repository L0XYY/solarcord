"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ServerDetail } from "@/lib/types";

export function CreateServerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (server: ServerDetail) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const { server } = await api<{ server: ServerDetail }>("/servers", {
        method: "POST",
        json: { name: name.trim() },
      });
      onCreated(server);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed to create server");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-night-900/70 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-fade-up rounded-2xl glass-strong p-6 shadow-glass"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold">Create a server</h2>
        <p className="mt-1 text-sm text-muted">
          Your server is where you and your community hang out. Make it yours.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <input
            autoFocus
            className="field"
            placeholder="Server name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {err && <p className="text-sm text-solar-ember">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button className="btn-solar" disabled={busy}>
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
