import { database } from "../../../../lib/db";
import { authCookie, createSession, verifyPassword } from "../../../../lib/session";

type LoginRow = { id: string; name: string; email: string; password_hash: string; password_salt: string };

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase(); const password = body.password || "";
    if (!email || !password) return Response.json({ error: "Enter your email and password." }, { status: 400 });
    const db = await database();
    const user = await db.prepare("SELECT id, name, email, password_hash, password_salt FROM users WHERE email = ? LIMIT 1").bind(email).first<LoginRow>();
    if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
    const token = await createSession(user.id);
    return Response.json({ user: { id: user.id, name: user.name, email: user.email } }, { headers: { "set-cookie": authCookie(token) } });
  } catch { return Response.json({ error: "Login is temporarily unavailable. Please try again." }, { status: 500 }); }
}
