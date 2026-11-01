import axe from "axe-core";

// Runs axe-core on the page (or part of it) and returns the serious and critical
// violations as readable lines; an empty list means the check passed (3.16).
// Left off on purpose:
//  - color-contrast: jsdom has no layout or computed colours, so contrast is
//    checked in the browser (Lighthouse, 04_TRD §9) against the tokens in 03_UI_Spec.
//  - region, landmark-one-main, page-has-heading-one: these judge a whole page, and
//    these tests render single components. The landmark and heading structure of the
//    real pages is tested separately.
export async function axeViolations(root: Element = document.body): Promise<string[]> {
  // jsdom has no canvas; axe probes for one and jsdom prints a warning each time.
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  const results = await axe.run(root, {
    rules: {
      "color-contrast": { enabled: false },
      region: { enabled: false },
      "landmark-one-main": { enabled: false },
      "page-has-heading-one": { enabled: false },
    },
  });
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.impact}: ${v.id} - ${v.help} -> ${v.nodes.map((n) => JSON.stringify(n.target)).join(", ")}`);
}
