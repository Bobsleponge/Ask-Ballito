import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / magic-link callback. Exchanges the auth code for a session and
 * redirects to the intended destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const authError = searchParams.get("error_description");

  if (authError) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(authError)}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
}
