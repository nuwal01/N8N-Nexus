import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password || "";
    if (!email || !password) return Response.json({ error: "Enter your email and password." }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return Response.json({ error: "Email or password is incorrect, or the email has not been confirmed." }, { status: 401 });
    return Response.json({ user: { id: data.user.id, email: data.user.email } });
  } catch {
    return Response.json({ error: "Login is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
