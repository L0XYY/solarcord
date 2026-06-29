import { randomBytes } from "node:crypto";
import { env } from "./env.js";

export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // link valid 24h
export const VERIFY_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week to verify

export function newVerifyToken(): { token: string; expires: Date } {
  return { token: randomBytes(32).toString("hex"), expires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS) };
}

export function verifyLink(token: string): string {
  const base = env.WEB_ORIGIN.replace(/\/$/, "");
  return `${base}/verify?token=${token}`;
}

/** True when a real email provider is configured. */
export function emailConfigured(): boolean {
  return !!env.RESEND_API_KEY;
}

// Send the verification email via Resend's HTTP API. In simulate mode (no key)
// this is a no-op that returns false, and callers surface the link in-app.
export async function sendVerificationEmail(to: string, link: string, opts?: { reminder?: boolean }): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.log(`[email:simulate] verification link for ${to}: ${link}`);
    return false;
  }
  const title = opts?.reminder ? "Action needed: confirm your email" : "Confirm your SolarCord email";
  const lead = opts?.reminder
    ? "Your SolarCord account still needs a confirmed email. Verify within your grace period or the account will be closed."
    : "Welcome to SolarCord! Confirm this is your email to keep your account active.";
  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;background:#0a0a0c;color:#f4f4f7;padding:32px;border-radius:16px;max-width:480px">
      <h1 style="font-size:20px;margin:0 0 8px">${title}</h1>
      <p style="color:#9a9aa6;line-height:1.6;margin:0 0 24px">${lead}</p>
      <a href="${link}" style="display:inline-block;background:#fff;color:#0a0a0c;font-weight:600;padding:12px 22px;border-radius:12px;text-decoration:none">Verify email</a>
      <p style="color:#6e6e7a;font-size:12px;margin:24px 0 0">Or paste this link into your browser:<br>${link}</p>
    </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject: title, html }),
    });
    if (!res.ok) {
      console.error("[email] Resend error", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] send failed", e);
    return false;
  }
}
