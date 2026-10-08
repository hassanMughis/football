import "server-only";

import { createClient, type Session } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "squad_sheet_admin_access";
const REFRESH_COOKIE = "squad_sheet_admin_refresh";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@squad-sheet.local").trim().toLowerCase();

function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase Auth is not configured.");
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function isAdminEmail(value: string | undefined) {
  return Boolean(value && value.toLowerCase() === ADMIN_EMAIL);
}

function isAuthConnectionError(error: { name?: string; message?: string; status?: number } | null) {
  return Boolean(error && (
    error.name === "AuthRetryableFetchError"
    || error.status === 0
    || (typeof error.status === "number" && error.status >= 500)
    || /fetch failed|network|timed out/i.test(error.message || "")
  ));
}

async function setSessionCookies(session: Session) {
  const store = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
  store.set(ACCESS_COOKIE, session.access_token, options);
  store.set(REFRESH_COOKIE, session.refresh_token, options);
}

async function broadcastPasswordChange() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;
  await fetch(`${url}/realtime/v1/api/broadcast/squad-sheet-state/events/password-changed`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json" },
    body: JSON.stringify({ changed: true }),
    cache: "no-store",
  }).catch(() => null);
}

export async function loginAdmin(password: unknown) {
  if (typeof password !== "string") return { ok: false as const, error: "Incorrect password.", status: 401 };
  const client = authClient();
  const { data, error } = await client.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
  if (isAuthConnectionError(error)) {
    return { ok: false as const, error: "Could not reach Supabase Auth. Try again.", status: 503 };
  }
  if (error || !data.session || !isAdminEmail(data.user?.email)) {
    return { ok: false as const, error: "Incorrect password.", status: 401 };
  }
  await setSessionCookies(data.session);
  return { ok: true as const };
}

export async function changeAdminPassword(currentPassword: unknown, newPassword: unknown) {
  if (typeof currentPassword !== "string") {
    return { ok: false as const, error: "The current password is incorrect.", status: 401 };
  }
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
    return { ok: false as const, error: "The new password must be 8 to 128 characters.", status: 400 };
  }
  if (currentPassword === newPassword) {
    return { ok: false as const, error: "Choose a new password that is different from the current password.", status: 400 };
  }

  const client = authClient();
  const login = await client.auth.signInWithPassword({ email: ADMIN_EMAIL, password: currentPassword });
  if (isAuthConnectionError(login.error)) {
    return { ok: false as const, error: "Could not reach Supabase Auth. Try again.", status: 503 };
  }
  if (login.error || !login.data.session || !isAdminEmail(login.data.user?.email)) {
    return { ok: false as const, error: "The current password is incorrect.", status: 401 };
  }
  const updated = await client.auth.updateUser({ password: newPassword, current_password: currentPassword });
  if (updated.error) {
    return { ok: false as const, error: updated.error.message || "Supabase could not change the password.", status: 400 };
  }

  // Revoke every old refresh token, then create one fresh 30-day browser session
  // for the device that performed the password change.
  await client.auth.signOut({ scope: "global" }).catch(() => null);
  const freshClient = authClient();
  const freshLogin = await freshClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: newPassword });
  if (freshLogin.error || !freshLogin.data.session) {
    await clearAdminSession();
    return { ok: false as const, error: "Password changed. Sign in again with the new password.", status: 409 };
  }
  await setSessionCookies(freshLogin.data.session);
  await broadcastPasswordChange();
  return { ok: true as const };
}

export async function isAdmin() {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return false;
  const client = authClient();
  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !isAdminEmail(data.user?.email)) {
    await clearAdminSession();
    return false;
  }
  await setSessionCookies(data.session);
  return true;
}

export async function clearAdminSession() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (accessToken && refreshToken) {
    const client = authClient();
    await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).catch(() => null);
    await client.auth.signOut({ scope: "local" }).catch(() => null);
  }
  const options = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
  store.set(ACCESS_COOKIE, "", options);
  store.set(REFRESH_COOKIE, "", options);
}
