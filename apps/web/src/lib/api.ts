"use client";
import { useAuth, type SelfUser } from "./store";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string[]>;
  constructor(status: number, code: string, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken: string };
  useAuth.getState().setToken(data.accessToken);
  return data.accessToken;
}

/**
 * Fetch wrapper: injects the access token, retries once after a silent refresh
 * on 401, and throws a typed ApiError on failure.
 */
export async function api<T = unknown>(
  path: string,
  opts: RequestInit & { json?: unknown } = {},
  _retried = false,
): Promise<T> {
  const { json, headers, ...rest } = opts;
  const token = useAuth.getState().accessToken;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (res.status === 401 && !_retried && path !== "/auth/refresh") {
    const fresh = await refreshAccessToken();
    if (fresh) return api<T>(path, opts, true);
    useAuth.getState().clear();
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (data as { error?: { code: string; message: string; fields?: Record<string, string[]> } }).error;
    throw new ApiError(res.status, e?.code ?? "INTERNAL", e?.message ?? "Request failed", e?.fields);
  }
  return data as T;
}

// Try to restore a session on app load (refresh cookie → access token → /me).
export async function bootstrapSession(): Promise<boolean> {
  const token = await refreshAccessToken();
  if (!token) return false;
  try {
    const { user } = await api<{ user: SelfUser }>("/auth/me");
    useAuth.getState().setAuth(token, user);
    return true;
  } catch {
    return false;
  }
}
