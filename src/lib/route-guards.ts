// Route guards: docs/02_AppFlow.md §2 (rules 1-3, 8). Pure functions so they
// can be unit-tested; src/middleware.ts supplies the session and org count.

// Rule 8: `next` must be a same-origin relative path.
export function sanitizeNext(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  // Backslashes and control characters can be read as a host by browsers.
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  return raw;
}

const GUEST_ONLY = ["/signup", "/login", "/forgot-password"];
// Allowed for a signed-in user with no organization (rule 3).
const ONBOARDING_EXEMPT = ["/onboarding", "/settings/profile", "/auth", "/reset-password"];

function matches(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export type RouteDecision =
  | { type: "next" }
  | { type: "redirect"; to: string };

export type GuardInput = {
  pathname: string;
  search: string;
  hasSession: boolean;
  // Number of organizations the user belongs to; null when unknown.
  orgCount: number | null;
  // /dev/* check pages are reachable only outside production.
  allowDev: boolean;
};

export function isGuestOnly(pathname: string): boolean {
  return GUEST_ONLY.some((p) => matches(pathname, p));
}

export function isPublic(pathname: string, allowDev: boolean): boolean {
  if (pathname === "/") return true;
  if (matches(pathname, "/auth")) return true;
  if (allowDev && matches(pathname, "/dev")) return true;
  return isGuestOnly(pathname);
}

// True when this request needs the org count (saves a query otherwise).
export function needsOrgCount(input: Omit<GuardInput, "orgCount">): boolean {
  const { pathname, hasSession, allowDev } = input;
  if (!hasSession) return false;
  if (pathname === "/" || isGuestOnly(pathname)) return false;
  if (allowDev && matches(pathname, "/dev")) return false;
  return !ONBOARDING_EXEMPT.some((p) => matches(pathname, p));
}

export function decideRoute(input: GuardInput): RouteDecision {
  const { pathname, search, hasSession, orgCount, allowDev } = input;

  if (!hasSession) {
    // S06 needs a recovery session; without one send the user to start over.
    if (matches(pathname, "/reset-password")) {
      return { type: "redirect", to: "/forgot-password" };
    }
    if (isPublic(pathname, allowDev)) return { type: "next" };
    // Rule 1
    const next = encodeURIComponent(`${pathname}${search}`);
    return { type: "redirect", to: `/login?next=${next}` };
  }

  // S01: signed-in users go to the dashboard. Rule 2: guest-only pages too.
  if (pathname === "/" || isGuestOnly(pathname)) {
    return { type: "redirect", to: "/dashboard" };
  }

  // Rule 3
  if (needsOrgCount({ pathname, search, hasSession, allowDev }) && orgCount === 0) {
    return { type: "redirect", to: "/onboarding" };
  }

  // Rule 4: signed-in with orgs may still open /onboarding.
  return { type: "next" };
}
