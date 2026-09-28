import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { apiError } from "../../../../lib/n8n";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) return Response.json({ error: "Could not end this session. Please try again.", code: "LOGOUT_FAILED" }, { status: 502 });
    return Response.json({ loggedOut: true });
  } catch (error) {
    return apiError(error);
  }
}
