import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env-schema";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("accepts a complete, valid environment", () => {
    expect(parseEnv(valid).NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("names every missing variable in the error", () => {
    expect(() => parseEnv({})).toThrowError(
      /NEXT_PUBLIC_SUPABASE_URL: missing[\s\S]*NEXT_PUBLIC_SUPABASE_ANON_KEY: missing[\s\S]*NEXT_PUBLIC_SITE_URL: missing/,
    );
  });

  it("rejects an invalid URL", () => {
    expect(() => parseEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "not-a-url" })).toThrowError(
      /NEXT_PUBLIC_SITE_URL/,
    );
  });

  it("points the developer at .env.example", () => {
    expect(() => parseEnv({})).toThrowError(/\.env\.example/);
  });
});
