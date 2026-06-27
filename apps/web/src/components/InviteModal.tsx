"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface InviteResult {
  code: string;
  expiresAt: string | null;
  maxUses: number | null;
}

export function InviteModal({ serverId, serverName, onClose }: { serverId: string; serverName: string; onClose: () => void }) {
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = invite ? `${window.location.origin}/invite/${invite.code}` : "";

  async function generate(expiresInHours?: number) {
    setError(null);
    setInvite(null);
    try {
      const { invite: created } = await api<{ invite: InviteResult }>(`/servers/${serverId}/invites`, {
        method: "POST",
        json: { expiresInHours: expiresInHours ?? 0 },
      });
      setInvite(created);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create invite");
    }
  }

  useEffect(() => {
    void generate(168); // default 7 days
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  async function copy() {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-night-900/70 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md animate-fade-up rounded-2xl glass-strong p-6 shadow-glass" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold">Invite people to {serverName}</h2>
        <p className="mt-1 text-sm text-muted">Share this link to grant access to your server.</p>

        <div className="mt-5 flex items-center gap-2 rounded-xl border border-line/10 bg-night-900/60 p-1.5">
          <input
            readOnly
            value={invite ? link : "Generating…"}
            className="flex-1 truncate bg-transparent px-2 text-sm text-ink outline-none"
          />
          <button onClick={copy} disabled={!invite} className="btn-solar px-4 py-2 text-sm">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-solar-ember">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Expire after:</span>
          {[
            ["1 hour", 1],
            ["1 day", 24],
            ["7 days", 168],
            ["Never", 0],
          ].map(([label, hrs]) => (
            <button
              key={label}
              onClick={() => generate(hrs as number)}
              className="rounded-full bg-night-700/60 px-3 py-1 font-medium hover:bg-night-600"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="btn-ghost">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
