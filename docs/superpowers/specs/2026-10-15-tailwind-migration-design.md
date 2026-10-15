# Tailwind CSS migration + shared UI primitives — Design

Status: approved-in-principle (all forks answered by the user, 2026-10-15)
Scope: `apps/web` only.

## Why

All styling lives in two disconnected places: a 312-line global `app.css`
(`.btn`, `.panel`, `.input-text`, `.badge`, layout) plus ~1 900 lines of
per-component scoped CSS across 8 components. The result is visible drift:

- progress bar markup written 4× (one copy — UploadWizard:243 — has **no CSS at all**)
- "small muted uppercase heading" written 5× with different sizes/tracking
- two different modal systems (`<dialog open>` without `showModal()` in
  UploadPanel vs a div with `role="dialog"` in UploadWizard)
- breakpoints 520 / 560 / 600 / 1000 px scattered across 5 files
- accent colour re-typed by hand (`rgba(85,199,242,…)`, `#7bd8fa`,
  `rgba(56,189,248,0.32)`) instead of a token

Goal: one styling system (Tailwind utilities), one set of shared primitives,
so a Button/Modal/Dropdown/input/progress looks the same everywhere and a
change happens in one place.

## Goals

1. Every style in markup is a Tailwind utility. Zero scoped `<style>` blocks
   remain in components.
2. `src/lib/components/ui/` holds the shared primitives; every screen uses
   them instead of hand-rolled markup.
3. Zero visual redesign: same palette, fonts, radii, shadows, spacing feel,
   same copy, same dimensions.
4. Duplication removed, not just relocated.

## Non-goals (explicitly not doing)

- No redesign, no new visual language, no light theme.
- No UI-library dependency (no shadcn / bits-ui / melt / clsx / floating-ui).
- No touch to `packages/core`, `apps/api`, `lib/stores/`, `lib/types.ts`,
  `lib/utils/motion.ts` (GSAP stays exactly as is).
- **Not** extracting the duplicated draggable-timeline into one component
  (TimelineEditor vs UploadWizard step 2). Both get restyled only. That
  dedupe is a behaviour change and a separate job.
- **Not** deduping `formatBytes`/`formatTime` logic duplication.
- No new features: no toast, tooltip, tab arrow-key navigation, stepper
  component, or theme switcher.

## Decisions (settled with the user)

| Fork | Decision |
|---|---|
| Tailwind version | v4 via `@tailwindcss/vite`. No `tailwind.config.js`, no PostCSS config. Tokens live in `@theme` inside `app.css`. |
| Visual result | Current look kept exactly; only consistency/cleanup changes. |
| Delivery | All components in one pass. |
| Modals | Both become one `Modal.svelte` using native `<dialog>` + `showModal()`. |
| "Dropdown" | New accessible `Dropdown.svelte` (listbox) replacing native `<select>`. |

## Constraints

- Svelte 5 runes only (`$props`, `$state`, `$derived`, `$effect`,
  `$bindable`); attribute event handlers (`onclick=`), never `on:`.
  `vite.config.ts` forces runes mode project-wide.
- No new runtime or dev dependency beyond `tailwindcss` + `@tailwindcss/vite`.
- Vite plugin order: `tailwindcss()` before `sveltekit({...})`.
- `@theme` must not clobber Tailwind's own scales: custom radius names are
  `control`/`card`/`panel`, not `sm`/`md`/`lg`.

## Token map (old → Tailwind v4 `@theme` → utility)

| Old `:root` var | `@theme` token | Utility |
|---|---|---|
| `--bg-canvas` | `--color-canvas: #0b0e13` | `bg-canvas` |
| `--bg-surface` | `--color-surface: #11151c` | `bg-surface` |
| `--bg-surface-elevated` | `--color-surface-2: #181e27` | `bg-surface-2` |
| `--bg-surface-active` | `--color-surface-3: #222a35` | `bg-surface-3` |
| `--border-subtle` | `--color-line-subtle: rgba(220,232,245,0.08)` | `border-line-subtle` |
| `--border-normal` | `--color-line-normal: rgba(220,232,245,0.14)` | `border-line-normal` |
| `--border-strong` | `--color-line-strong: rgba(220,232,245,0.24)` | `border-line-strong` |
| `--text-primary` | `--color-ink: #f1f5f9` | `text-ink` |
| `--text-secondary` | `--color-ink-secondary: #a2afbf` | `text-ink-secondary` |
| `--text-muted` | `--color-ink-muted: #758397` | `text-ink-muted` |
| `--accent-primary` | `--color-accent: #55c7f2` | `bg-accent` / `text-accent` |
| `--accent-primary-hover` | `--color-accent-hover: #35b1e3` | `bg-accent-hover` |
| (`.btn-primary:hover` literal) | `--color-accent-bright: #7bd8fa` | `hover:bg-accent-bright` |
| `--accent-yellow` | `--color-warn: #facc15` | `text-warn` |
| `--accent-rose` | `--color-danger: #f43f5e` | `text-danger` |
| `--accent-emerald` | `--color-ok: #10b981` | `text-ok` |
| `--font-sans` | `--font-sans: 'Space Grotesk', …` | `font-sans` |
| `--font-display` | `--font-display: 'Montserrat', sans-serif` | `font-display` |
| `--radius-sm` | `--radius-control: 8px` | `rounded-control` |
| `--radius-md` | `--radius-card: 12px` | `rounded-card` |
| `--radius-lg` | `--radius-panel: 18px` | `rounded-panel` |
| `--shadow-card` | `--shadow-card: …` | `shadow-card` |
| `--shadow-box` | `--shadow-box: …` | `shadow-box` |
| `@keyframes indeterminate` ×2 | `--animate-indeterminate: indeterminate 1.2s ease-in-out infinite alternate` | `animate-indeterminate` |

Base layer keeps only what utilities cannot express: `*` reset (Preflight
already covers it — drop the manual one), `html/body` colour + `14px` font,
the global `:focus-visible` outline, thin scrollbar styling,
`prefers-reduced-motion` kill-switch.

## Shared primitives — API is fixed

`src/lib/utils/cn.ts` — one line: joins truthy class strings.

`src/lib/components/ui/index.ts` — barrel export.

| Component | Props (all others spread onto the root element) |
|---|---|
| `Button.svelte` | `variant?: 'primary'\|'secondary'\|'danger'\|'ghost'` (default `secondary`), `size?: 'sm'\|'md'` (`md`), `type?: 'button'\|'submit'` (`button`), `disabled?`, `class?`, `onclick?`, `children` snippet |
| `Input.svelte` | `value` (`$bindable`), `type?`, `placeholder?`, `disabled?`, `class?` |
| `Field.svelte` | `label?`, `for?`, `children` snippet — replaces `.form-group`/`.form-label` |
| `Select.svelte` | thin styling wrapper over native `<select>`; only for cases a real popup would be wrong (e.g. inside the wizard footer) |
| `Dropdown.svelte` | `options: {value,label}[]`, `value` (`$bindable` string), `label?`, `ariaLabel?`, `disabled?`, `size?` (`sm`\|`md`), `class?` |
| `Modal.svelte` | `open` (`$bindable` boolean), `title: string`, `size?: 'md'\|'lg'`, `onClose?()`, `children` snippet, `footer?` snippet |
| `Progress.svelte` | `value?` (0–100), `label?`, `size?` (`sm`\|`md`). No `value` ⇒ indeterminate |
| `Badge.svelte` | `tone?: 'neutral'\|'danger'\|'warn'\|'ok'` (`neutral`), `children` |
| `SectionTitle.svelte` | `size?: 'sm'\|'md'`, `children` — the single "small uppercase muted heading" |
| `StatusRow.svelte` | `tone?: 'muted'\|'error'\|'warn'\|'ok'` (`muted`), `role?: 'status'\|'alert'`, `children` |

Behaviour requirements that are **not** optional:

- `Modal`: `showModal()` on open, `close()` on close; `cancel` (Esc) and
  `close` events both set `open = false` and call `onClose`; click on the
  backdrop (event target is the `<dialog>` itself) closes; `aria-labelledby`
  pointing at the rendered `<h2>`; native focus trap and focus restore.
- `Dropdown`: trigger has `aria-haspopup="listbox"` + `aria-expanded`; popup
  is `role="listbox"` with `role="option"` + `aria-selected`; keyboard
  Enter/Space/ArrowDown/ArrowUp/Home/End/Enter/Escape; Escape returns focus
  to the trigger; click-outside closes and returns focus.
- `Progress`: `role="progressbar"` + `aria-valuenow`/`min`/`max` only when
  determinate.

## Lane ownership (no two writers touch one file)

- **Lane 0 — foundation, serial, finishes first:** `apps/web/package.json`,
  `apps/web/vite.config.ts`, `apps/web/src/app.css`, `src/lib/utils/cn.ts`,
  `src/lib/components/ui/**`
- **Lane A:** `src/routes/+layout.svelte`, `src/routes/+page.svelte`,
  `src/lib/components/Header.svelte`
- **Lane B:** `src/lib/components/UploadPanel.svelte`,
  `src/lib/components/UploadWizard.svelte`
- **Lane C:** `src/lib/components/TimelineEditor.svelte`,
  `src/lib/components/TranscriptEditor.svelte`
- **Lane D:** `src/lib/components/Preview916.svelte`,
  `src/lib/components/FontEditor.svelte`,
  `src/lib/components/RenderPanel.svelte`

Component prop APIs in "Shared primitives" are frozen: lanes A–D may consume
them, none may edit Lane 0's files. `+page.svelte` keeps passing the same
props to `UploadPanel` / `UploadWizard` / `Preview916` / `Header` as today.

## Rules for every lane

- Delete the component's `<style>` block entirely.
- No raw hex/rgba in markup — theme tokens and alpha utilities only
  (`bg-accent/15`, `border-danger/30`).
- Genuinely dynamic values stay inline: `style:width={pct + '%'}`,
  `style:left={x + 'px'}`, `style:--playhead-position`,
  `style:--active-accent`.
- Preserve every existing `aria-*`, `role`, keyboard handler, copy string,
  and `use:gsapReveal` / `use:gsapInteractions` / `{#key}`.
- Breakpoint regularisation: do not invent new values. Existing
  `max-width: 520 / 560 / 600` ⇒ `max-sm:`; existing `1000px` grid collapse
  ⇒ `max-lg:`. Use only Tailwind's `sm`/`md`/`lg`/`xl` (+ `max-*` variants).
- Header stays 56 px, main stays `max-w-[1800px]`, studio grid stays
  `1.55fr / minmax(320px, 1fr)`.

## Acceptance / verification

1. `cd apps/web && bun run check` — no new errors or a11y warnings.
2. `cd apps/web && bun run build` — succeeds.
3. `grep -rn "<style" apps/web/src` — zero component `<style>` blocks.
4. `grep -rn "rgba(\|#[0-9a-f]\{6\}" apps/web/src/lib/components
   apps/web/src/routes` — no leftover hard-coded colour except intentional
   inline dynamic values, which must be listed.
5. Emitted build CSS contains the `@theme` variables the inline `style:`
   directives rely on (`--color-accent`, `--active-accent` source). If
   Tailwind drops unused theme vars, add an explicit `:root` fallback.
6. Dev-server smoke test in a browser: page renders; both modals open, close
   on Esc and on backdrop click; the Dropdown opens, keyboard-selects, closes;
   progress bars appear; no console errors. Screenshot desktop + narrow
   viewport and compare against the pre-migration look.

## Left to the builder (settled here, change only with reason)

- Exact Tailwind class strings inside each primitive.
- Whether `Modal` fade-in uses `@starting-style` or no animation (visual
  parity is satisfied by no animation; `gsapReveal` already fires on mount).

## Addendum — rulings after the builder check

The doc above said only "keep the look". That leaves five real forks; they
are settled here so no lane has to guess.

**A1 — `Modal` gets an optional `header` snippet.**

The frozen `title`-only header cannot express either live modal: UploadPanel's
header is title + "Wizard Pengaturan" link + ✕, and UploadWizard's is title +
✕ + the three-step stepper bar. Ruling:

```
Modal props: open ($bindable) · title · size · onClose · header? · children · footer?
```
- No `header` snippet ⇒ built-in row: `<h2 id={titleId}>{title}</h2>` + a ghost ✕ `Button`.
- `header` snippet receives `{ close }` so custom headers can close the dialog.
- `title` stays required — it always supplies the `aria-labelledby` target.
- Sizes, matched to the current CSS: `md` = `max-w-[520px]` (UploadPanel:140),
  `lg` = `max-w-[720px]` (UploadWizard:378). Both get `max-h-[88vh]` and the
  body scrolls.
- Backdrop click: `click` on the `<dialog>` element itself (works in every
  browser), which needs exactly one documented
  `<!-- svelte-ignore a11y_click_events_have_key_events -->`. That one ignore
  replaces the two existing ones (UploadPanel:44, UploadWizard:128);
  acceptance #1 means "no new warning categories".

**A2 — `Dropdown` replaces only the ungrouped select; `Select` keeps the grouped one.**

- Preview916:87 ("Format preview") has no `<optgroup>` ⇒ becomes `Dropdown`.
- FontEditor:32-50 uses `<optgroup label="Standar & Google Fonts">` /
  `"Font Kustom Diimpor"` (dynamic) ⇒ stays a native `<select>`, styled by
  `Select.svelte`, because `Dropdown.options: {value,label}[]` cannot express
  groups and flattening the font list would be a visible redesign.
- So both `Dropdown` and `Select` have a real consumer. Neither is dead code.

**A3 — the layout shell stays as `@apply` component classes in `app.css`.**

`.app-shell` / `.app-main` / `.studio-grid` / `.preview-column` / `.panel` /
`.panel-header` / `.panel-body` are used by lanes A, C and D. Re-typing those
utility chains in every file would just relocate the duplication (against
Goal 4) and no primitive covers them. They live in
`@layer components { … @apply … }` in `app.css` — still Tailwind, single
source of truth, owned by Lane 0 only. `.panel-title` is dropped in favour of
`SectionTitle`.

**A4 — `Input` is text-like only.**

`Input.svelte` covers text/number/url/native-select-adjacent controls.
FontEditor's `range`, checkbox toggle card, `color` and hidden `file` inputs
keep their own markup and are styled with utilities in place (`accent-accent`
for the range/toggle). Forcing them through `Input` would degrade the controls
and break visual parity.

**A5 — both indeterminate progress duplicates are fixed.**

`UploadWizard.svelte:243` (markup with no CSS at all) and
`TranscriptEditor.svelte:27` both become `<Progress />` with no `value`.
