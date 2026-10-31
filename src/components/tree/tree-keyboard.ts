import type { VisibleRow } from "@/lib/tree";

// Keyboard model for the tree (03_UI_Spec §8.6): up/down move, right expands or
// goes to the first child, left collapses or goes to the parent, Enter opens the
// detail, Space toggles expand. Pure so it is unit tested without a DOM.

export type TreeKeyAction =
  | { type: "focus"; id: string }
  | { type: "toggle"; id: string; open: boolean }
  | { type: "open"; id: string };

export function treeKeyAction(rows: readonly VisibleRow[], index: number, key: string): TreeKeyAction | null {
  const row = rows[index];
  if (!row) return null;
  const { node, hasChildren, expanded } = row;
  const at = (i: number): TreeKeyAction | null => {
    const target = rows[i];
    return target ? { type: "focus", id: target.node.id } : null;
  };

  switch (key) {
    case "ArrowDown":
      return at(Math.min(index + 1, rows.length - 1));
    case "ArrowUp":
      return at(Math.max(index - 1, 0));
    case "Home":
      return at(0);
    case "End":
      return at(rows.length - 1);
    case "ArrowRight":
      if (!hasChildren) return null;
      return expanded ? at(index + 1) : { type: "toggle", id: node.id, open: true };
    case "ArrowLeft":
      if (hasChildren && expanded) return { type: "toggle", id: node.id, open: false };
      return node.parent_id && rows.some((r) => r.node.id === node.parent_id)
        ? { type: "focus", id: node.parent_id }
        : null;
    case "Enter":
      return { type: "open", id: node.id };
    case " ":
      return hasChildren ? { type: "toggle", id: node.id, open: !expanded } : null;
    default:
      return null;
  }
}
