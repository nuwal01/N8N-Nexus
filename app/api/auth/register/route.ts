import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { appUrl } from "../../../../lib/app-url";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; email?: string; password?: string };
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password || "";
    if (!name || name.length < 2 || name.length > 80) return Response.json({ error: "Enter a name between 2 and 80 characters." }, { status: 400 });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    if (password.length < 12 || password.length > 200) return Response.json({ error: "Use a password between 12 and 200 characters." }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const emailRedirectTo = appUrl("/auth/callback", request.url).toString();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo } });
    if (error) {
      const duplicate = /already|registered|exists/i.test(error.message);
      return Response.json({ error: duplicate ? "An account with this email already exists." : "Account creation failed. Check the details and try again." }, { status: duplicate ? 409 : 400 });
    }
    if (!data.user) return Response.json({ error: "Account creation failed. Please try again." }, { status: 500 });
    return Response.json({ user: { id: data.user.id, name, email }, requiresEmailConfirmation: !data.session }, { status: 201 });
  } catch {
    return Response.json({ error: "Account creation is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
