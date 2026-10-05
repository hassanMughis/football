import { clearAdminSession, isAdmin, setAdminSession, validAdminPassword } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ authenticated: await isAdmin() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  if (!validAdminPassword(body?.password)) {
    return Response.json({ error: "Incorrect password." }, { status: 401 });
  }
  await setAdminSession();
  return Response.json({ authenticated: true });
}

export async function DELETE() {
  await clearAdminSession();
  return Response.json({ authenticated: false });
}
