#!/usr/bin/env bash
# Plan 4.10: Lighthouse (mobile) on /login and on the 1000-node event tree page.
# Needs `pnpm build && pnpm start` running in another terminal, and `pnpm perf:seed` done once.
# Nothing is installed in the project: lighthouse runs through `pnpm dlx`, Chrome comes from Playwright.
set -euo pipefail

CHROME_PATH="$(pnpm --silent exec node -e "console.log(require('@playwright/test').chromium.executablePath())")"
export CHROME_PATH
COOKIE="$(pnpm --silent perf:page --cookie)"
TREE_URL="$(pnpm --silent perf:page --url)"

run() { # name url [extra headers json]
  local name="$1" url="$2" headers="${3:-}"
  local args=(--form-factor=mobile --only-categories=performance,accessibility --quiet --no-enable-error-reporting
              --chrome-flags="--headless" --output=json --output-path="/tmp/lh-$name.json")
  if [ -n "$headers" ]; then args+=(--extra-headers "$headers"); fi
  pnpm --silent dlx lighthouse "$url" "${args[@]}" >/dev/null
  node -e "const r=require('/tmp/lh-$name.json');console.log('$name', 'performance', r.categories.performance.score*100, '| accessibility', r.categories.accessibility.score*100, '| CLS', r.audits['cumulative-layout-shift'].numericValue, '| final url', r.finalDisplayedUrl)"
}

run login "http://localhost:3000/login"
run tree "$TREE_URL" "{\"Cookie\":\"$COOKIE\"}"
