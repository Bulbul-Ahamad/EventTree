/**
 * Plan 4.10: server response time of the event tree page, as the perf owner, over N requests.
 * Run against a production build for real numbers:  pnpm build && pnpm start   then   pnpm perf:page
 * Prints min / median / p95 in ms. Budget (04_TRD section 9): p95 <= 1000 ms.
 * With --cookie it prints the Cookie header, with --url the page address (both for Lighthouse), and exits.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

try {
  (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile?.(".env.local");
} catch {
  // optional
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const base = process.env.PERF_BASE_URL ?? "http://localhost:3000";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) throw new Error("local Supabase only");

async function main() {
  const jar = new Map<string, string>();
  const client = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value } of list) jar.set(name, value);
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: "perf-owner@demo.test", password: "Passw0rd!perf" });
  if (error) throw new Error(`sign in: ${error.message} (run pnpm perf:seed first)`);
  const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
  if (process.argv.includes("--cookie")) {
    process.stdout.write(`${cookie}\n`);
    return;
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const ev = await admin.from("nodes").select("id").eq("type", "event").eq("title", "Perf Event (1000 nodes)").limit(1).single();
  if (ev.error) throw new Error(`find event: ${ev.error.message}`);
  const page = `${base}/o/perf-club/events/${ev.data.id}`;
  if (process.argv.includes("--url")) {
    process.stdout.write(`${page}\n`);
    return;
  }

  const times: number[] = [];
  let bytes = 0;
  for (let i = 0; i < 45; i++) {
    const t0 = performance.now();
    const res = await fetch(page, { headers: { cookie } });
    const body = await res.text();
    const ms = performance.now() - t0;
    bytes = Buffer.byteLength(body);
    if (res.status !== 200 || !body.includes("Perf Event")) throw new Error(`unexpected response ${res.status}`);
    if (i >= 5) times.push(ms); // the first five warm up the server
  }
  times.sort((a, b) => a - b);
  const at = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))] ?? 0;
  process.stdout.write(`tree page, 1000 nodes, ${times.length} requests\n`);
  process.stdout.write(`min ${at(0).toFixed(0)} ms | median ${at(0.5).toFixed(0)} ms | p95 ${at(0.95).toFixed(0)} ms | max ${at(1).toFixed(0)} ms\n`);
  process.stdout.write(`page HTML: ${(bytes / 1024).toFixed(0)} KB uncompressed\n`);
  process.stdout.write(`${at(0.95) <= 1000 ? "OK: within the 1.0 s budget" : "OVER the 1.0 s budget"}\n`);
}

void main();
