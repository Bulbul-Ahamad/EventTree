import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  },
}));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
}));

const session = {
  access_token: "header.payload.signature",
  refresh_token: "refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: "00000000-0000-0000-0000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "owner@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
};

describe("createServerClient", () => {
  beforeEach(() => jar.clear());

  it("reads the session from the request cookie", async () => {
    // Storage key is sb-<first label of the Supabase host>-auth-token.
    jar.set("sb-localhost-auth-token", JSON.stringify(session));
    const { createServerClient } = await import("@/lib/supabase/server");
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getSession();
    expect(data.session?.user.id).toBe(session.user.id);
  });

  it("has no session when there is no cookie", async () => {
    const { createServerClient } = await import("@/lib/supabase/server");
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
  });
});
