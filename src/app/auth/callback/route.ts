import { NextResponse, type NextRequest } from "next/server";
import { sanitizeNext } from "@/lib/route-guards";
import { createServerClient } from "@/lib/supabase/server";

// Email-confirmation, password-recovery and OAuth links land here with ?code=.
// Exchanges the code for a session cookie, then redirects to a safe `next`.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next")) ?? "/dashboard";

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/login?error=callback", origin));
}
