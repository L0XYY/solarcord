"use client";
import { create } from "zustand";

export interface SelfUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  pronouns: string | null;
  status: string;
  customStatus: string | null;
  themePrimary: string | null;
  themeAccent: string | null;
  isStaff: boolean;
}

interface AuthState {
  accessToken: string | null;
  user: SelfUser | null;
  setAuth: (token: string, user: SelfUser) => void;
  setToken: (token: string) => void;
  clear: () => void;
}

// Access token lives in memory only (never localStorage) — refresh token is an
// httpOnly cookie the browser holds, so a page reload re-auths via /auth/refresh.
export const useAuth = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  setToken: (accessToken) => set({ accessToken }),
  clear: () => set({ accessToken: null, user: null }),
}));
