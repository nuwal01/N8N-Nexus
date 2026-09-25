import { database } from "../../../../lib/db";
import { authCookie, createSession, hashPassword } from "../../../../lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; email?: string; password?: string };
    const name = body.name?.trim(); const email = body.email?.trim().toLowerCase(); const password = body.password || "";
    if (!name || name.length < 2 || name.length > 80) return Response.json({ error: "Enter a name between 2 and 80 characters." }, { status: 400 });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    if (password.length < 12 || password.length > 200) return Response.json({ error: "Use a password between 12 and 200 characters." }, { status: 400 });
    const db = await database();
    if (await db.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first()) return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    const userId = crypto.randomUUID(); const passwordData = await hashPassword(password); const createdAt = new Date().toISOString();
    await db.prepare("INSERT INTO users (id, name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(userId, name, email, passwordData.hash, passwordData.salt, createdAt).run();
    const token = await createSession(userId);
    return Response.json({ user: { id: userId, name, email } }, { status: 201, headers: { "set-cookie": authCookie(token) } });
  } catch { return Response.json({ error: "Account creation failed. Please try again." }, { status: 500 }); }
}
