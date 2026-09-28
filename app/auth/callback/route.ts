import { type NextRequest, NextResponse } from "next/server";
import { appUrl } from "../../../lib/app-url";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");

  if (code && !providerError) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(appUrl("/dashboard", request.url));
  }

  return NextResponse.redirect(appUrl("/auth/error", request.url));
}
