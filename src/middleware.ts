import { NextResponse, type NextRequest } from "next/server";
import { decideRoute, needsOrgCount } from "@/lib/route-guards";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  const hasSession = user !== null;
  const allowDev = process.env.NODE_ENV !== "production";

  let orgCount: number | null = null;
  if (needsOrgCount({ pathname, search, hasSession, allowDev })) {
    const { count, error } = await supabase
      .from("org_members")
      .select("org_id", { count: "exact", head: true });
    orgCount = error ? null : count;
  }

  const decision = decideRoute({ pathname, search, hasSession, orgCount, allowDev });
  if (decision.type === "next") return response;

  const redirect = NextResponse.redirect(new URL(decision.to, request.url));
  // Keep any refreshed session cookies on the redirect.
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
