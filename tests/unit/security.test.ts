import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Plan 4.11 / 04_TRD §8: the checks CI is supposed to do, as tests, so they run on every `pnpm test`.

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path, ext) : ext.test(name) ? [path] : [];
  });
}

describe("source rules (§8 rules 3, 6, 12)", () => {
  const sources = files("src", /\.(ts|tsx)$/).map((path) => ({ path, text: readFileSync(path, "utf8") }));

  it.each([
    ["the service role key", /service_role|SERVICE_ROLE/i],
    ["dangerouslySetInnerHTML", /dangerouslySetInnerHTML/],
    ["eval()", /\beval\s*\(/],
    ["new Function()", /new Function\s*\(/],
    ["console.log", /console\.log\s*\(/],
  ])("src contains no %s", (_name, pattern) => {
    const hits = sources.filter((s) => pattern.test(s.text)).map((s) => s.path);
    expect(hits).toEqual([]);
  });

  it("src/types/database.ts is the only place that names the service role, if at all", () => {
    const hits = sources.filter((s) => /service_role/i.test(s.text)).map((s) => s.path);
    expect(hits).toEqual([]);
  });
});

describe("SECURITY DEFINER functions in the migrations (§8 rule 2)", () => {
  const sql = files("supabase/migrations", /\.sql$/)
    .sort()
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  const revoked = [...sql.matchAll(/revoke execute on function([\s\S]*?);/gi)].map((m) => m[1]).join(" ");
  const definers = [...sql.matchAll(/create (?:or replace )?function ((?:public|app_private)\.\w+)\(/gi)]
    .map((m) => {
      const start = m.index ?? 0;
      const header = sql.slice(start, sql.indexOf("$$", start));
      const body = sql.slice(sql.indexOf("$$", start), sql.indexOf("$$", sql.indexOf("$$", start) + 2));
      return { name: m[1] ?? "", header, body };
    })
    .filter((f) => /security definer/i.test(f.header));

  it("finds the functions", () => {
    expect(definers.length).toBeGreaterThan(20);
  });

  it("every one sets search_path", () => {
    expect(definers.filter((f) => !/set search_path/i.test(f.header)).map((f) => f.name)).toEqual([]);
  });

  it("every callable one (not a trigger) has execute revoked from public and anon", () => {
    const callable = definers.filter((f) => !/returns trigger/i.test(f.header));
    expect(callable.filter((f) => !revoked.includes(`${f.name}(`)).map((f) => f.name)).toEqual([]);
  });

  it("every RPC in public checks auth.uid()", () => {
    const rpc = definers.filter((f) => f.name.startsWith("public."));
    expect(rpc.filter((f) => !f.body.includes("auth.uid()")).map((f) => f.name)).toEqual([]);
  });

  it("no function is granted to anon", () => {
    const grants = [...sql.matchAll(/grant execute on function([^;]*);/gi)].map((m) => m[1] ?? "");
    expect(grants.length).toBeGreaterThan(5);
    expect(grants.filter((g) => /\bto\b[^;]*\banon\b/i.test(g))).toEqual([]);
  });
});

describe("security headers (§8 rule 9)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function headersFor(nodeEnv: string) {
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.resetModules();
    const config = (await import("../../next.config")).default;
    const rules = await config.headers?.();
    const all = rules?.find((r) => r.source === "/(.*)")?.headers ?? [];
    return new Map(all.map((h) => [h.key, h.value]));
  }

  it("sends the full set on every route", async () => {
    const h = await headersFor("production");
    expect(h.get("X-Content-Type-Options")).toBe("nosniff");
    expect(h.get("X-Frame-Options")).toBe("DENY");
    expect(h.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(h.get("Permissions-Policy")).toMatch(/camera=\(\)/);
    expect(h.get("Strict-Transport-Security")).toMatch(/max-age=\d+/);
  });

  it("production CSP: self only, Supabase for connections, no eval, no framing", async () => {
    const csp = (await headersFor("production")).get("Content-Security-Policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/\bws:/);
  });

  it("pictures may load from the Supabase origin (signed avatar URLs)", async () => {
    const csp = (await headersFor("production")).get("Content-Security-Policy") ?? "";
    expect(csp).toContain("img-src 'self' data: https: https://abc.supabase.co");
  });

  it("development CSP also allows eval and websockets for the dev server", async () => {
    const csp = (await headersFor("development")).get("Content-Security-Policy") ?? "";
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
  });
});

describe("proof links (§8 rule 6)", () => {
  it("open in a new tab with noopener noreferrer nofollow", () => {
    const text = readFileSync("src/components/tree/activity-timeline.tsx", "utf8");
    expect(text).toContain('rel="noopener noreferrer nofollow"');
    expect(text).toContain('target="_blank"');
  });
});
