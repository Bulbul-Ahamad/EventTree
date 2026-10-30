import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ERROR_CODES, ERROR_MESSAGES, isErrorCode } from "@/lib/errors";

// Contract tests between Postgres and the app (step 2.10): every code the
// database can raise must be in the catalogue, and the catalogue must say what
// 02_AppFlow §7 says.

const ROOT = process.cwd();
const migrationsDir = join(ROOT, "supabase", "migrations");

function raisedCodes(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    for (const m of sql.matchAll(/raise\s+exception\s+'([^']*)'/gi)) {
      const code = m[1] ?? "";
      found.set(code, [...(found.get(code) ?? []), file]);
    }
  }
  return found;
}

describe("database error codes", () => {
  const raised = raisedCodes();

  it("finds the codes raised by the migrations", () => {
    expect(raised.size).toBeGreaterThan(10);
  });

  it("every code raised in a migration is in the app catalogue", () => {
    const unknown = [...raised.keys()].filter((c) => !isErrorCode(c));
    expect(unknown, `not in ERROR_MESSAGES: ${unknown.join(", ")}`).toEqual([]);
  });

  it("every raise exception sends only a bare E_ code (no SQL text can reach the client)", () => {
    for (const code of raised.keys()) expect(code).toMatch(/^E_[A-Z_]+$/);
  });

  it("every raise uses SQLSTATE P0001", () => {
    for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"))) {
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      for (const m of sql.matchAll(/raise\s+exception\s+'E_[A-Z_]+'([^;]*);/gi)) {
        expect(m[1] ?? "", file).toMatch(/errcode\s*=\s*'P0001'/i);
      }
    }
  });
});

describe("02_AppFlow §7 table", () => {
  const doc = readFileSync(join(ROOT, "docs", "02_AppFlow.md"), "utf8");
  const section = doc.slice(doc.indexOf("## 7. Error Catalogue"), doc.indexOf("## 8."));
  const rows = [...section.matchAll(/^\| `(E_[A-Z_]+)` \| (.+) \|$/gm)].map((m) => [m[1] ?? "", m[2] ?? ""] as const);

  it("lists exactly the app's codes", () => {
    expect(rows.map(([c]) => c).sort()).toEqual([...ERROR_CODES].sort());
  });

  it("uses the same wording as the app for every code with a fixed message", () => {
    for (const [code, text] of rows) {
      if (code === "E_VALIDATION") continue; // field-level Zod messages
      expect(text, code).toBe(`"${ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES]}"`);
    }
  });
});
