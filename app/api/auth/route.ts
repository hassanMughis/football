import { changeAdminPassword, clearAdminSession, isAdmin, loginAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ authenticated: await isAdmin() });
  } catch {
    return Response.json({ authenticated: false, error: "Could not verify the admin session." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  try {
    const result = await loginAdmin(body?.password);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ authenticated: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not verify the admin password." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null) as { currentPassword?: unknown; newPassword?: unknown } | null;
  try {
    const result = await changeAdminPassword(body?.currentPassword, body?.newPassword);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ authenticated: true, changed: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not change the admin password." }, { status: 503 });
  }
}

export async function DELETE() {
  await clearAdminSession();
  return Response.json({ authenticated: false });
}
