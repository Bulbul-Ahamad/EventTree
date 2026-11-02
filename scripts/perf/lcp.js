// Plan 4.10: what Lighthouse says about the Largest Contentful Paint, from the file perf:lighthouse wrote.
// Run:  node scripts/perf/lcp.js /tmp/lh-tree.json
const r = require(process.argv[2] || "/tmp/lh-tree.json");
const out = (s) => process.stdout.write(`${s}\n`);
const find = (o, depth = 0) => {
  if (!o || typeof o !== "object" || depth > 8) return [];
  const hit = o.type === "node" && o.snippet ? [o] : [];
  return hit.concat(...Object.values(o).map((v) => find(v, depth + 1)));
};
const a = r.audits;
const keys = Object.keys(a).filter((k) => /lcp|largest-contentful/.test(k));
out(`audits about LCP: ${keys.join(", ")}`);
for (const k of keys) {
  const nodes = find(a[k].details).slice(0, 2);
  nodes.forEach((n) => out(`${k}: ${n.nodeLabel ?? ""} | ${String(n.snippet).slice(0, 160)}`));
}
const bd = a["lcp-breakdown-insight"]?.details?.items ?? [];
out(`breakdown: ${JSON.stringify(bd).slice(0, 600)}`);
out(`LCP value: ${a["largest-contentful-paint"].displayValue}`);
