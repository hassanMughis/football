import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "squad_sheet_admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "3456";

function equal(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionToken() {
  const secret = process.env.ADMIN_SESSION_SECRET || ADMIN_PASSWORD;
  return createHash("sha256").update(`squad-sheet:${ADMIN_PASSWORD}:${secret}`).digest("hex");
}

export function validAdminPassword(value: unknown) {
  return typeof value === "string" && equal(value, ADMIN_PASSWORD);
}

export async function isAdmin() {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value || "";
  return equal(value, sessionToken());
}

export async function setAdminSession() {
  (await cookies()).set(ADMIN_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAdminSession() {
  (await cookies()).set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
