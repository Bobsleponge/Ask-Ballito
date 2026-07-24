import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import { env } from "@/lib/env";

/**
 * OAuth / magic-link callback. Exchanges the auth code for a session and
 * redirects to the intended destination on the configured site origin
 * (not the request Host header).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));
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
