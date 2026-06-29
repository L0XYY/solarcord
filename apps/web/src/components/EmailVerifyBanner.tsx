"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth, type SelfUser } from "@/lib/store";
import { Icon } from "./Icon";

function daysLeft(deadline?: string | null): number | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

// Shown across the top of the app whenever the signed-in user hasn't verified
// their email. Counts down the grace period and offers resend / change-email.
export function EmailVerifyBanner() {
  const { user, accessToken, setAuth } = useAuth();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user || user.emailVerified) return null;

  const left = daysLeft(user.emailDeadline);

  async function resend() {
    setBusy(true);
    setNote(null);
    try {
      const r = await api<{ sent?: boolean; configured?: boolean; verifyLink?: string }>("/auth/resend-verification", { method: "POST" });
      if (r.verifyLink) {
        setLink(r.verifyLink);
        setNote("Email isn't configured yet — use the link below to verify.");
      } else {
        setNote("Verification email sent. Check your inbox (and spam).");
      }
    } catch {
      setNote("Couldn't send right now. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  async function changeEmail() {
    if (!email.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await api<{ user: SelfUser; verifyLink?: string }>("/users/me/email", { method: "PATCH", json: { email: email.trim() } });
      if (r.user && accessToken) setAuth(accessToken, r.user);
      setEditing(false);
      setEmail("");
      if (r.verifyLink) {
        setLink(r.verifyLink);
        setNote("Email updated. Email isn't configured yet — use the link below to verify.");
      } else {
        setNote("Email updated — we sent a verification link to the new address.");
      }
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : "Couldn't update email.");
    } finally {
      setBusy(false);
    }
  }

  const urgent = left !== null && left <= 2;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-sm"
      style={{ background: urgent ? "rgba(216,60,60,.16)" : "rgba(232,179,57,.14)", borderBottom: "1px solid rgb(var(--line) / 0.08)" }}
    >
      <Icon name="warn" size={16} className={urgent ? "text-solar-ember" : "text-amber-400"} />
      <span className="font-medium">
        Verify your email
        {left !== null && (
          <>
            {" "}
            — <span className={urgent ? "text-solar-ember" : "text-amber-400"}>{left === 0 ? "less than a day" : `${left} day${left === 1 ? "" : "s"}`} left</span> before this account is
            closed
          </>
        )}
        .
      </span>

      {!editing ? (
        <span className="flex items-center gap-2">
          <button onClick={resend} disabled={busy} className="rounded-lg bg-night-700/70 px-2.5 py-1 text-xs font-medium hover:bg-night-600">
            Resend email
          </button>
          <button onClick={() => setEditing(true)} className="rounded-lg bg-night-700/70 px-2.5 py-1 text-xs font-medium hover:bg-night-600">
            Change email
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && changeEmail()}
            placeholder="you@realmail.com"
            className="field max-w-[220px] py-1 text-xs"
          />
          <button onClick={changeEmail} disabled={busy} className="btn-solar px-2.5 py-1 text-xs">
            Save
          </button>
          <button onClick={() => setEditing(false)} className="rounded-lg px-2 py-1 text-xs text-muted hover:text-ink">
            Cancel
          </button>
        </span>
      )}

      {note && <span className="text-xs text-muted">{note}</span>}
      {link && (
        <a href={link} className="text-xs font-semibold text-solar underline">
          Open verification link
        </a>
      )}
    </div>
  );
}
