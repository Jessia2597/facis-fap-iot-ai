# Visual audit — current `--facis-*` tokens vs FAP General Guideline §14

**Date**: 2026-05-04 (Phase 6 / Step 6.1)
**Reference**: `/Users/danielpires/Developer/Ciberseg/Atlas/guidelines and examples/FAP_UI_General_Guideline_Reference_Aligned.md` §13–§16
**Audited file**: `services/ai-insight-ui/ui/app/src/styles/variables.css`

The existing `variables.css` was written for an early prototype and is **mostly close** to the FAP guideline but **drifts on 8 specific tokens** plus is missing the shell-radius and shell-layout primitives the guideline mandates.

## Token-by-token diff

| FAP §14 token | FAP value | Current `--facis-*` | Match? |
|---|---|---|---|
| Canvas background | `#E1E7EF` | `--facis-bg: #f8fafc` | ❌ drift — current is too light/cool, not the FAP cool-gray |
| Surface | `#FFFFFF` | `--facis-surface: #ffffff` | ✅ |
| Primary action | `#005FFF` | `--facis-primary: #005fff` | ✅ |
| Primary hover | `#2563EB` | `--facis-primary-dark: #0047cc` | ❌ drift — current is darker than FAP's hover blue |
| Primary soft (hover bg) | `#ECF4FF` | `--facis-primary-light: #e8f0fe` | ❌ drift — close but not the FAP value |
| Secondary accent | `#3B82F6` | `--facis-info: #3b82f6` | ✅ (matches via the `info` token) |
| Text strong | `#1F2937` | `--facis-text: #1e293b` | ❌ drift — current uses Tailwind slate-800; FAP uses gray-800 |
| Text muted | `#6B7280` | `--facis-text-secondary: #64748b` | ❌ drift — current uses slate-500; FAP uses gray-500 |
| Border | `#E5E7EB` | `--facis-border: #e2e8f0` | ❌ drift — current is slate-200; FAP is gray-200 |
| Success | `#10B981` | `--facis-success: #22c55e` | ❌ drift — current is green-500; FAP wants emerald-500 |
| Warning | `#F59E0B` | `--facis-warning: #f59e0b` | ✅ |
| Danger | `#EF4444` | `--facis-error: #ef4444` | ✅ |
| Shell radius | `20px` | (not defined) | ❌ MISSING |
| Control radius | `8px` | `--facis-radius: 8px` | ✅ |
| Small radius | `6px` | `--facis-radius-sm: 6px` | ✅ |
| Soft shadow | `0 1px 4px rgba(0,0,0,0.10)` | `--facis-shadow: 0 1px 3px rgba(0,0,0,0.08)` | ❌ drift — current is shorter and lighter |
| Hover shadow | `0 4px 12px rgba(59,130,246,0.20)` | (not defined; `--facis-shadow-md` exists with neutral rgba) | ❌ MISSING the blue-tinted hover shadow |

## Spacing scale

| FAP §15 | Current | Match? |
|---|---|---|
| `--space-1: 4px` | (not defined) | ❌ |
| `--space-2: 8px` | (not defined) | ❌ |
| `--space-3: 12px` | (not defined) | ❌ |
| `--space-4: 16px` | (not defined) | ❌ |
| `--space-5: 24px` | (not defined) | ❌ |
| `--space-6: 32px` | (not defined) | ❌ |

The current code uses ad-hoc rem values (`0.25rem`, `0.5rem`, `1rem`, etc.) inline. Centralising into the `--space-*` scale per §15 means consistent spacing across views.

## Typography

| FAP §14.3 | Current | Match? |
|---|---|---|
| Sans-serif stack (`Segoe UI` / `Roboto` / system) | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif` | ✅ Inter is FAP-compatible (modern sans, system-fallbacks correct) |
| Large title ~24px | (no `--font-size-xl` defined; views use ad-hoc) | ⚠️ no centralised scale |
| Body 14–16px | `font-size: 14px` (html), `1rem` body | ✅ baseline correct |
| Helper 12–14px | `.text-xs`, `.text-sm` defined | ✅ |

## Layout structure

| FAP §13 mandatory principle | Current | Match? |
|---|---|---|
| 1. One centred main shell | App.vue uses sidebar + main layout, not centred shell at 1200px | ❌ drift — full-width admin layout, not the FAP split-shell |
| 2. Cool gray outer canvas behind shell | `body` background is `--facis-bg: #f8fafc` (too light) and there is no centred shell on top | ❌ |
| 3. White content surfaces | Cards use `--facis-surface: #ffffff` ✅ | ✅ |
| 4. Single blue accent | Sidebar / buttons / links use `--facis-primary` ✅ | ✅ (no competing accents) |
| 5. Soft corners | Most surfaces use 8px ✅ but no 20px shell radius | ⚠️ partial |
| 6. Moderate shadows | Current shadows are subtle ✅ | ✅ |
| 7. Subtle motion | No exaggerated animation in source | ✅ |
| 8. Restrained typography | Inter sans-serif throughout | ✅ |
| 9. One primary task per screen | View structure varies — some views have many KPIs and tabs | ⚠️ design discipline issue, not a token issue |
| 10. Separation of guidance / progress / content | `PageHeader` component separates title + breadcrumbs from body | ✅ |

## PrimeVue overrides

`overrides.css` correctly remaps PrimeVue's `--p-*` tokens to `--facis-*` ones. After Step 6.2 updates the `--facis-*` values, PrimeVue components automatically inherit the FAP palette — no per-component edits needed.

## Per-view drift survey

Spot-checked 10 representative views for hardcoded colour literals (vs token references):

```
grep -rE "#[0-9A-Fa-f]{3,8}" src/views/ | wc -l
```

Result: ~120 hex literals across views — most are inline `style="color:#..."` and `<svg fill="#...">` for icons. Mass-converting to tokens is low ROI; the cascade-driven approach (fix tokens, let PrimeVue inherit) covers >80% of visible UI without touching views.

The remaining hex literals worth converting: `App.vue` sidebar (uses `--facis-*` tokens already), `PageHeader.vue` (uses tokens), `KpiCard.vue` (uses tokens). Per-view audit deferred to Step 6.4 as a sweep.

## What Step 6.2 will fix (token-level)

- Update `--facis-bg` → `#E1E7EF` (FAP cool gray canvas)
- Update `--facis-primary-dark` → `#2563EB` (FAP primary hover)
- Update `--facis-primary-light` → `#ECF4FF` (FAP primary soft)
- Update `--facis-text` → `#1F2937` (FAP gray-800)
- Update `--facis-text-secondary` → `#6B7280` (FAP gray-500)
- Update `--facis-border` → `#E5E7EB` (FAP gray-200)
- Update `--facis-success` → `#10B981` (FAP emerald-500)
- Update `--facis-shadow` → `0 1px 4px rgba(0,0,0,0.10)` (FAP soft shadow)
- ADD `--facis-radius-shell: 20px` (FAP shell radius)
- ADD `--facis-shadow-hover: 0 4px 12px rgba(59,130,246,0.20)` (FAP blue-tinted hover)
- ADD `--space-1` through `--space-6` (FAP 4/8/12/16/24/32px scale)

## What Step 6.3 will add (shell layout)

- New `shell.css` with `.main-container { max-width: 1200px; margin: calc((100vh - 700px) / 2) auto; ... }` per §15
- App.vue refactor: cool-gray canvas behind a centred white shell. Sidebar + main moved INTO the shell so the contained-layout discipline holds at desktop breakpoints.

## What Step 6.4 will sweep

Per-view audit for any inline `style="color:#..."` that doesn't reference a token, plus DataTable / form input padding cleanups so they match the FAP recipe (§15 input).

## What Step 6.5 will gate

A Playwright snapshot spec captures the canonical look of 5 representative views (Dashboard, AI Assistant, Alerts, Smart City, Analytics) as the visual baseline. Future PRs that change pixels are blocked by the snapshot diff unless explicitly approved.
