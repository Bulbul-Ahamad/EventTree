# 03 — UI Specification (Design System)

> Single source of truth for visual design. **Never hard-code colors, font sizes or spacing in components** — use the tokens below.
> Stack: Tailwind CSS 4 + shadcn/ui (Radix primitives) + lucide-react icons. See `04_TRD.md`.

---

## 1. Principles

1. **Mobile-first**: design at 360 px, scale up. Touch targets ≥ 44 × 44 px.
2. **Calm, dense, readable**: this is a work tool; prioritize scanning speed over decoration.
3. **Status by more than color**: always pair color with an icon or text (accessibility).
4. **Bangla-safe**: all text containers must handle Bangla script (taller line-height, no clipping).
5. **WCAG 2.2 AA** minimum contrast (4.5:1 text, 3:1 UI components).

## 2. Color Tokens

Defined as CSS variables on `:root` (light) and `.dark` (dark). Tailwind maps them via `@theme inline` (see §9). Components reference **semantic** names only.

### 2.1 Core palette

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--background` | `#F6FBF8` | `#08130F` | App background |
| `--surface` | `#FFFFFF` | `#0F1D17` | Cards, dialogs, panels |
| `--surface-muted` | `#EDF5F0` | `#17281F` | Table headers, hovered rows, inputs bg (dark) |
| `--border` | `#D8E7DE` | `#223A2E` | Default borders, dividers |
| `--border-strong` | `#BFD6C8` | `#2F4D3D` | Input borders, emphasized dividers |
| `--foreground` | `#0F1F17` | `#F1F5F9` | Primary text |
| `--foreground-muted` | `#3F5A4B` | `#CBD5E1` | Secondary text |
| `--foreground-subtle` | `#5B7566` | `#94A3B8` | Placeholder, captions, disabled text |
| `--primary` | `#047857` | `#10B981` | Primary buttons, links, focus accents |
| `--primary-hover` | `#065F46` | `#34D399` | |
| `--primary-active` | `#064E3B` | `#6EE7B7` | |
| `--primary-soft` | `#ECFDF5` | `#052E22` | Selected row, subtle highlight |
| `--primary-foreground` | `#FFFFFF` | `#08130F` | Text on `--primary` |
| `--ring` | `#10B981` | `#34D399` | Focus ring |
| `--success` | `#15803D` | `#4ADE80` | |
| `--success-soft` | `#DCFCE7` | `#052E16` | |
| `--warning` | `#B45309` | `#FBBF24` | |
| `--warning-soft` | `#FEF3C7` | `#422006` | |
| `--danger` | `#B91C1C` | `#F87171` | Destructive actions, errors, overdue |
| `--danger-soft` | `#FEE2E2` | `#450A0A` | |
| `--danger-foreground` | `#FFFFFF` | `#08130F` | Text on solid `--danger` |
| `--info` | `#1D4ED8` | `#60A5FA` | |
| `--info-soft` | `#DBEAFE` | `#172554` | |

### 2.2 Task status tokens (badge background / text)

| Status | Light bg / fg | Dark bg / fg | Icon (lucide) | Label |
|---|---|---|---|---|
| `todo` | `#EDF5F0` / `#3F5A4B` | `#17281F` / `#CBD5E1` | `Circle` | To do |
| `in_progress` | `#DBEAFE` / `#1D4ED8` | `#172554` / `#93C5FD` | `Loader` | In progress |
| `submitted` | `#FEF3C7` / `#92400E` | `#422006` / `#FCD34D` | `Hourglass` | Submitted |
| `verified` | `#DCFCE7` / `#166534` | `#052E16` / `#86EFAC` | `CheckCircle2` | Verified |

Overdue: due-date text uses `--danger` + `AlertCircle` icon.

### 2.3 Priority tokens (text + icon `Flag`)

| Priority | Light | Dark |
|---|---|---|
| `low` | `#64748B` | `#94A3B8` |
| `medium` | `#1D4ED8` | `#60A5FA` |
| `high` | `#B45309` | `#FBBF24` |
| `urgent` | `#B91C1C` | `#F87171` |

### 2.4 Progress bar

| Part | Light | Dark |
|---|---|---|
| Track | `#D8E7DE` | `#223A2E` |
| Fill (0–99%) | `--primary` | `--primary` |
| Fill (100%) | `--success` | `--success` |

## 3. Theme Rules (Light / Dark)

1. Theme modes: `system` (default), `light`, `dark`. Implemented with `next-themes`, attribute `class` (adds `.dark` on `<html>`), `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`.
2. No flash of wrong theme: `next-themes` script runs before paint; `<html suppressHydrationWarning>`.
3. In dark mode, elevation is expressed by **surface color + border**, not by heavy shadows.
4. Never use pure `#000` or pure `#FFF` for large backgrounds (use tokens).
5. Images/avatars: no filter changes in dark mode.
6. Every new component must be visually checked in both themes before its plan step is ticked.

## 4. Typography

| Role | Font stack |
|---|---|
| Sans (UI) | `Inter` via `next/font/google` (weights 400, 500, 600, 700), fallback: `"Noto Sans Bengali"`, `system-ui`, `sans-serif` |
| Bangla fallback | `Noto Sans Bengali` via `next/font/google` (weights 400, 500, 600, 700), applied in the `font-sans` stack so Bangla glyphs render consistently |
| Mono | `JetBrains Mono` (join codes, IDs) |

Type scale (size / line-height). Bangla text uses +2 px line-height automatically via `:lang(bn)` rule: `line-height: 1.7`.

| Token | Size | Line height | Weight | Usage |
|---|---|---|---|---|
| `text-xs` | 12 px | 16 px | 500 | Captions, badges |
| `text-sm` | 14 px | 20 px | 400/500 | Secondary text, table cells, tree rows |
| `text-base` | 16 px | 24 px | 400 | Body, inputs (16 px prevents iOS zoom) |
| `text-lg` | 18 px | 28 px | 600 | Card titles |
| `text-xl` | 20 px | 28 px | 600 | Section headings |
| `text-2xl` | 24 px | 32 px | 700 | Page titles (mobile) |
| `text-3xl` | 30 px | 36 px | 700 | Page titles (≥ md) |
| `text-4xl` | 36 px | 40 px | 700 | Landing hero only |

Rules: max line length 72 ch for prose; letter-spacing default; headings use `text-balance`; truncate with ellipsis in tree rows (single line) and show full text in tooltip/detail panel.

## 5. Spacing, Sizing, Radii, Elevation

- **Base unit 4 px.** Allowed spacing scale (Tailwind steps): `0, 1(4), 2(8), 3(12), 4(16), 5(20), 6(24), 8(32), 10(40), 12(48), 16(64)`. No arbitrary pixel values.
- Page gutters: 16 px (< md), 24 px (md), 32 px (≥ lg). Content max width 1200 px, centered.
- Card padding: 16 px (< md), 24 px (≥ md). Stack gap inside forms: 16 px. Between sections: 32 px.

| Radius token | Value | Usage |
|---|---|---|
| `--radius-sm` | 6 px | Badges, checkboxes |
| `--radius-md` | 8 px | Buttons, inputs, menus |
| `--radius-lg` | 12 px | Cards, dialogs |
| `--radius-xl` | 16 px | Sheets (top corners) |
| `--radius-full` | 9999 px | Avatars, pills |

| Shadow token | Light | Dark |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgb(15 23 42 / 0.06)` | `none` (use border) |
| `--shadow-md` | `0 4px 12px rgb(15 23 42 / 0.08)` | `0 4px 12px rgb(0 0 0 / 0.40)` |
| `--shadow-lg` | `0 12px 32px rgb(15 23 42 / 0.12)` | `0 12px 32px rgb(0 0 0 / 0.55)` |

Z-index scale: `base 0`, `sticky 10`, `dropdown 20`, `sheet/drawer 30`, `dialog 40`, `toast 50`.

Breakpoints (mobile-first): `sm 640`, `md 768`, `lg 1024`, `xl 1280`.

Layout metrics: top bar 56 px; left nav 240 px (≥ lg); detail drawer 440 px (≥ md), full screen below; **tree row height 44 px**; **tree indent 12 px/level (< md), 20 px/level (≥ md)**; avatar sizes 24 / 32 / 40 px.

## 6. Motion

- Duration 150 ms, easing `cubic-bezier(0.2, 0, 0, 1)` for hover/press/expand. Sheets/dialogs 200 ms.
- Respect `prefers-reduced-motion: reduce` → disable transforms/animations (keep opacity fades ≤ 100 ms).
- Skeleton shimmer 1.2 s linear loop (disabled for reduced motion).

## 7. Iconography

`lucide-react`, stroke width 1.75, sizes 16 (inline), 20 (buttons), 24 (nav). Type icons: Event `CalendarDays`, Segment `FolderTree` (collapsed `Folder`), Task `CheckSquare`. Every icon-only button has `aria-label` and a tooltip.

## 8. Component Specifications & States

All interactive components must implement: **default, hover, active/pressed, focus-visible, disabled, loading (where async), error (where input)**.

Focus ring (global): `outline: 2px solid var(--ring); outline-offset: 2px`. Never remove without replacement.

### 8.1 Button
| Variant | Default | Hover | Active | Disabled |
|---|---|---|---|---|
| `primary` | bg `--primary`, text `--primary-foreground` | bg `--primary-hover` | bg `--primary-active` | 50% opacity, `cursor-not-allowed` |
| `secondary` | bg `--surface`, border `--border-strong`, text `--foreground` | bg `--surface-muted` | bg `--border` | 50% |
| `ghost` | transparent, text `--foreground-muted` | bg `--surface-muted` | bg `--border` | 50% |
| `destructive` | bg `--danger`, text `--danger-foreground` | 90% opacity | 80% | 50% |
- Sizes: `sm` h 32, `md` h 40 (default), `lg` h 48; icon button 40 × 40 (min 44 target via padding on touch).
- Loading: replace leading icon with spinner, keep width, `aria-busy="true"`, disabled.

### 8.2 Input / Textarea / Select
- Height 40 (textarea min 96), radius `--radius-md`, border `--border-strong`, bg `--surface` (light) / `--surface-muted` (dark), text 16 px.
- Hover: border `--foreground-subtle`. Focus: border `--ring` + focus ring. Error: border `--danger`, helper text `--danger` with `AlertCircle`, `aria-invalid="true"`, `aria-describedby`. Disabled: bg `--surface-muted`, text `--foreground-subtle`.
- Label above field (`text-sm`, 500). Required marked with `*` and `aria-required`.

### 8.3 Checkbox / Verify tick
- 20 px box, radius `--radius-sm`. Unchecked: border `--border-strong`. Checked: bg `--success`, white check. Indeterminate (not used for tasks). Disabled: 50%.
- **Verify tick button** (icon button, `Check`): ghost → on hover `--success-soft` bg + `--success` icon; loading shows spinner; tooltip "Mark verified".

### 8.4 Badge (StatusBadge, RoleChip, EventStatusBadge)
- Height 24, padding 0 8, `text-xs` 500, radius full, icon 14 px + label. Colors from §2.2. Event status: draft = `todo` palette, active = `in_progress` palette, completed = `verified` palette, archived = `todo` palette with `Archive` icon.
- Role chip (Owner / Head / Assignee): `--primary-soft` bg, `--primary` text.

### 8.5 ProgressBar
- Height 8 (tree) / 12 (event header), radius full, track/fill per §2.4, `role="progressbar"` + `aria-valuenow`. Percent label `text-xs` tabular-nums (`font-variant-numeric: tabular-nums`). Fill width animates 150 ms.

### 8.6 TreeNodeRow (core component)
- Height 44, flex row: `[indent][chevron 20][type icon 20][title (flex-1, truncate)][assignee][right meta][⋮]`.
- States: default (transparent), hover (`--surface-muted`), selected (`--primary-soft` + 2 px left border `--primary`), focus-visible (ring inset), disabled/pending mutation (60% opacity + spinner on right meta).
- Keyboard: `↑/↓` move, `→` expand, `←` collapse/parent, `Enter` open detail, `Space` toggles expand. Role `treeitem` inside `role="tree"`, `aria-expanded`, `aria-level`.
- Mobile (< md): assignee shows avatar only; due date moves under title as caption; right meta shows only progress % or status icon.
- "Unassigned": dashed-outline chip with `UserPlus` icon, color `--warning`.
- Overdue task: due-date caption in `--danger`.

### 8.7 Dialog / Sheet / Drawer
- Dialog: max-w 480 (forms 560), radius `--radius-lg`, backdrop `rgb(15 23 42 / 0.5)` (light) / `rgb(0 0 0 / 0.65)` (dark), focus trapped, Esc closes, returns focus to trigger. Footer buttons right-aligned (secondary left of primary); on mobile stacked full-width with primary on top.
- Node detail: right Drawer ≥ md (440 px), full-screen Sheet below md (slides up, top radius `--radius-xl`).

### 8.8 DropdownMenu (row actions)
- Item height 40, destructive items in `--danger`, separators `--border`. Disabled items hidden unless explaining a rule (then disabled + tooltip).

### 8.9 Toast
- Bottom-center (mobile) / bottom-right (≥ md). Variants: success (`--success`), error (`--danger`), info. Auto-dismiss 3 s (errors 6 s). Pause on hover. `role="status"` (errors `role="alert"`).

### 8.10 EmptyState
- Centered, icon 40 px in `--foreground-subtle`, title `text-lg`, body `text-sm` `--foreground-muted` (max-w 360), optional single primary CTA. Copy comes from `02_AppFlow.md`.

### 8.11 Skeleton
- bg `--surface-muted`, radius matches target element, shimmer overlay. Tree skeleton = 8 rows with varying indent.

### 8.12 Avatar
- Image or initials (first letters of first two words; Bangla-safe using `Array.from`). Bg derived from user id into one of 6 fixed `--primary-soft`-family tints; initials in `--primary`.

### 8.13 Tabs / Segmented control
- Height 36, selected: bg `--surface` + `--shadow-sm` (light) / bg `--primary-soft` (dark); container bg `--surface-muted`.

### 8.14 Banner (draft / read-only)
- Full-width in event header, bg `--info-soft` (draft) or `--warning-soft` (read-only), text `--foreground`, icon `Info`/`Lock`.

## 9. Token Implementation (reference for `src/app/globals.css`)

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background:#F6FBF8; --surface:#FFFFFF; --surface-muted:#EDF5F0;
  --border:#D8E7DE; --border-strong:#BFD6C8;
  --foreground:#0F1F17; --foreground-muted:#3F5A4B; --foreground-subtle:#5B7566;
  --primary:#047857; --primary-hover:#065F46; --primary-active:#064E3B;
  --primary-soft:#ECFDF5; --primary-foreground:#FFFFFF; --ring:#10B981;
  --success:#15803D; --success-soft:#DCFCE7;
  --warning:#B45309; --warning-soft:#FEF3C7;
  --danger:#B91C1C; --danger-soft:#FEE2E2; --danger-foreground:#FFFFFF;
  --info:#1D4ED8; --info-soft:#DBEAFE;
  --radius-sm:6px; --radius-md:8px; --radius-lg:12px; --radius-xl:16px;
}
.dark {
  --background:#08130F; --surface:#0F1D17; --surface-muted:#17281F;
  --border:#223A2E; --border-strong:#2F4D3D;
  --foreground:#F1F5F9; --foreground-muted:#CBD5E1; --foreground-subtle:#94A3B8;
  --primary:#10B981; --primary-hover:#34D399; --primary-active:#6EE7B7;
  --primary-soft:#052E22; --primary-foreground:#08130F; --ring:#34D399;
  --success:#4ADE80; --success-soft:#052E16;
  --warning:#FBBF24; --warning-soft:#422006;
  --danger:#F87171; --danger-soft:#450A0A; --danger-foreground:#08130F;
  --info:#60A5FA; --info-soft:#172554;
}
@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-surface-muted: var(--surface-muted);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-foreground: var(--foreground);
  --color-foreground-muted: var(--foreground-muted);
  --color-foreground-subtle: var(--foreground-subtle);
  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-primary-active: var(--primary-active);
  --color-primary-soft: var(--primary-soft);
  --color-primary-foreground: var(--primary-foreground);
  --color-ring: var(--ring);
  --color-success: var(--success);  --color-success-soft: var(--success-soft);
  --color-warning: var(--warning);  --color-warning-soft: var(--warning-soft);
  --color-danger: var(--danger);    --color-danger-soft: var(--danger-soft);
  --color-danger-foreground: var(--danger-foreground);
  --color-info: var(--info);        --color-info-soft: var(--info-soft);
  --radius-sm: var(--radius-sm); --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg); --radius-xl: var(--radius-xl);
  --font-sans: var(--font-inter), var(--font-bengali), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, monospace;
}
:lang(bn) { line-height: 1.7; }
```

Status/priority tokens (§2.2, §2.3) are exposed as variables `--status-{name}-bg|fg` and `--priority-{name}` in the same two blocks.

## 10. Accessibility Checklist (applies to every screen)

- Landmarks (`header`, `nav`, `main`), one `h1` per page, logical heading order.
- All form controls have visible labels; errors announced via `aria-live="polite"`.
- Color never the only signal (status has icon + text; overdue has icon + text).
- Keyboard-complete: tree navigation, dialogs, menus. Skip-to-content link.
- Tap targets ≥ 44 px; no hover-only functionality.
- Test with 200% zoom and 360 px viewport: no horizontal scroll, no clipped Bangla text.
