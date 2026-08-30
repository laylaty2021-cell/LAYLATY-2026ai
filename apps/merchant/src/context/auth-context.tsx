"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api-client";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "@/lib/token-storage";

type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Same shape as apps/customer's AuthController: a single source of truth
// for "is someone logged in", checked once on mount and updated by
// login()/logout(). Dashboard pages redirect to /login when this is
// 'unauthenticated' — see src/app/dashboard/page.tsx.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("unknown");

  useEffect(() => {
    // One-time sync from an external system (localStorage) on mount, kept
    // out of the initial render so server and client markup match before
    // hydration — status starts "unknown" on both.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(getAccessToken() ? "authenticated" : "unauthenticated");
  }, []);

  async function login(identifier: string, password: string) {
    const response = await apiFetch<{ accessToken: string; refreshToken: string }>(
      "/auth/login",
      { method: "POST", body: { identifier, password }, auth: false },
    );
    saveTokens(response.accessToken, response.refreshToken);
    setStatus("authenticated");
  }

  async function logout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await apiFetch("/auth/logout", { method: "POST", body: { refreshToken } });
      } catch {
        // Best-effort server-side revocation; the local session clears regardless.
      }
    }
    clearTokens();
    setStatus("unauthenticated");
  }

  return <AuthContext.Provider value={{ status, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
