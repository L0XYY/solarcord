"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError, bootstrapSession } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { disconnectSocket } from "@/lib/socket";
import { initials } from "@/lib/ui";

interface Preview {
  code: string;
  valid: boolean;
  server: { id: string; name: string; iconUrl: string | null; memberCount: number };
}

export default function InvitePage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = params.code;
  const { accessToken } = useAuth();

  const [state, setState] = useState<"loading" | "needauth" | "ready" | "error">("loading");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    (async () => {
      let token = accessToken;
      if (!token) token = (await bootstrapSession()) ? useAuth.getState().accessToken : null;
      if (!token) {
        setState("needauth");
        return;
      }
      try {
        const { invite } = await api<{ invite: Preview }>(`/invites/${code}`);
        setPreview(invite);
        setState("ready");
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "This invite is invalid");
        setState("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function join() {
    setJoining(true);
    setError(null);
    try {
      await api(`/invites/${code}/join`, { method: "POST" });
      // Reconnect the gateway so the socket joins the newly-joined server's rooms.
      disconnectSocket();
      router.replace("/app");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not join");
      setJoining(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md animate-fade-up rounded-2xl glass-strong p-8 text-center shadow-glass">
        {state === "loading" && (
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-solar/30 border-t-solar" />
        )}

        {state === "needauth" && (
          <>
            <h1 className="text-xl font-bold">You&apos;ve been invited</h1>
            <p className="mt-2 text-sm text-muted">Log in or create an account to join this server.</p>
            <div className="mt-6 flex justify-center gap-2">
              <Link href={`/login?next=/invite/${code}`} className="btn-solar">
                Log in
              </Link>
              <Link href="/signup" className="btn-ghost">
                Sign up
              </Link>
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-night-700 text-2xl">⚠</div>
            <h1 className="text-xl font-bold">Invite unavailable</h1>
            <p className="mt-2 text-sm text-muted">{error}</p>
            <Link href="/app" className="btn-ghost mt-6 inline-flex">
              Back to SolarCord
            </Link>
          </>
        )}

        {state === "ready" && preview && (
          <>
            <div className="mx-auto mb-4 grid h-20 w-20 place-items-center overflow-hidden rounded-3xl bg-gradient-to-br from-solar to-solar-glow text-2xl font-black text-night-900 shadow-glow">
              {preview.server.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.server.iconUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials(preview.server.name)
              )}
            </div>
            <p className="text-xs uppercase tracking-wider text-muted">You&apos;ve been invited to join</p>
            <h1 className="mt-1 text-2xl font-extrabold">{preview.server.name}</h1>
            <p className="mt-2 text-sm text-muted">{preview.server.memberCount} members</p>
            {error && <p className="mt-3 text-sm text-solar-ember">{error}</p>}
            {preview.valid ? (
              <button onClick={join} disabled={joining} className="btn-solar mt-6 w-full py-3 text-base">
                {joining ? "Joining…" : "Accept invite"}
              </button>
            ) : (
              <p className="mt-6 text-sm text-solar-ember">This invite has expired or reached its limit.</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
