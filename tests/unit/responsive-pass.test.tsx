import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/ui/badge";

// 3.15: guards for the responsive and dark-mode pass. The visual checks are
// manual (see the checklist in 06_Plan.md); these keep the rules from slipping back.

describe("StatusBadge compact", () => {
  it("keeps the label for screen readers and shows it from md up", () => {
    render(<StatusBadge status="submitted" compact />);
    const label = screen.getByText("Submitted");
    expect(label).toHaveClass("sr-only", "md:not-sr-only");
  });

  it("the default badge always shows its label", () => {
    render(<StatusBadge status="verified" />);
    expect(screen.getByText("Verified")).not.toHaveClass("sr-only");
  });
});

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(full);
  }
  return out;
}

const SRC = join(process.cwd(), "src");

describe("design tokens only (CLAUDE.md §2): nothing is hard-coded, so dark mode follows the tokens", () => {
  const files = sourceFiles(SRC).filter((f) => !f.endsWith("globals.css") && !f.includes("types/database"));

  it("finds the source files", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("has no hex colours, black/white utilities or palette colours", () => {
    const bad: string[] = [];
    const hex = /#[0-9a-fA-F]{3,8}\b/;
    const named = /\b(?:text|bg|border|ring|fill|stroke)-(?:white|black|(?:red|green|blue|gray|slate|zinc|neutral|stone|amber|yellow|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/;
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      text.split("\n").forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "");
        // "#main" style anchors and ids are not colours
        if (named.test(code) || (hex.test(code) && !/href=|#main|"#"|aria-|id=/.test(code))) {
          bad.push(`${relative(SRC, f)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });
});
