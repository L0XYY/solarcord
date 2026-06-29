"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Logo } from "@/components/Logo";

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [msg, setMsg] = useState("Confirming your email…");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMsg("This link is missing its verification token.");
      return;
    }
    api("/auth/verify-email", { method: "POST", json: { token } })
      .then(() => {
        setState("ok");
        setMsg("Your email is verified. Your account is safe.");
      })
      .catch((e) => {
        setState("error");
        setMsg(e instanceof ApiError ? e.message : "We couldn't verify this link.");
      });
  }, [token]);

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm rounded-2xl glass-strong p-8 text-center shadow-glass">
        <div className="flex justify-center">
          <Logo size={56} />
        </div>
        <h1 className="mt-5 text-xl font-extrabold">
          {state === "working" ? "Verifying…" : state === "ok" ? "Email verified" : "Verification failed"}
        </h1>
        <div
          className={`mx-auto mt-4 grid h-12 w-12 place-items-center rounded-full text-2xl ${
            state === "ok" ? "bg-emerald-400/15 text-emerald-400" : state === "error" ? "bg-solar-ember/15 text-solar-ember" : ""
          }`}
        >
          {state === "working" ? (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-solar/30 border-t-solar" />
          ) : state === "ok" ? (
            "✓"
          ) : (
            "✕"
          )}
        </div>
        <p className="mt-4 text-sm text-muted">{msg}</p>
        {state === "ok" ? (
          <button onClick={() => router.replace("/app")} className="btn-solar mt-6 w-full">
            Continue to SolarCord
          </button>
        ) : state === "error" ? (
          <Link href="/app" className="btn-ghost mt-6 inline-flex w-full justify-center">
            Back to SolarCord
          </Link>
        ) : null}
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
