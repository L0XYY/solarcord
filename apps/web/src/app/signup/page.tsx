"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth, type SelfUser } from "@/lib/store";
import { AuthShell } from "@/components/AuthShell";

export default function SignupPage() {
  const router = useRouter();
  const setAuth = useAuth((s) => s.setAuth);
  const [form, setForm] = useState({ email: "", username: "", displayName: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api<{ user: SelfUser; accessToken: string }>("/auth/signup", {
        method: "POST",
        json: {
          email: form.email,
          username: form.username,
          displayName: form.displayName || undefined,
          password: form.password,
        },
      });
      setAuth(data.accessToken, data.user);
      router.replace("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Join SolarCord in seconds">
      <form onSubmit={onSubmit} className="space-y-4">
        <input className="field" type="email" placeholder="Email" autoComplete="email" value={form.email} onChange={set("email")} required />
        <input className="field" placeholder="Username" autoComplete="username" value={form.username} onChange={set("username")} required />
        <input className="field" placeholder="Display name (optional)" value={form.displayName} onChange={set("displayName")} />
        <input className="field" type="password" placeholder="Password (min 8 chars)" autoComplete="new-password" value={form.password} onChange={set("password")} required />
        {error && <p className="text-sm text-solar-ember">{error}</p>}
        <button className="btn-solar w-full" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-solar hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
