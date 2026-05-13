#!/usr/bin/env node
/**
 * Codemod: replace hardcoded hex literals with token references.
 *
 * Reads every src/**\/*.{vue,css} (excluding tokens.css and StatusBadge.vue),
 * substitutes the literals from MAPPING below, and writes a migration report
 * listing every unresolved hex literal so they can be addressed in a Phase 2b
 * manual sweep.
 *
 * Quote-preserving: we replace ONLY the hex token, leaving any surrounding
 * quotes intact. So:
 *   CSS:  `color: #22c55e`         → `color: var(--color-success)`
 *   JS :  `color: '#22c55e'`       → `color: 'var(--color-success)'`
 *   JS :  `borderColor: "#22c55e"` → `borderColor: "var(--color-success)"`
 *
 * Run from ui/app/:  node scripts/migrate-hex-to-tokens.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

const ROOT = process.cwd()
const SRC_DIRS = ['src/views', 'src/components']
const SKIP_FILES = new Set(['tokens.css', 'StatusBadge.vue'])

// Mapping: lowercased hex → token reference. We lowercase before matching so
// every casing variant collapses to one row.
const MAPPING = {
  // Greens / success
  '#22c55e': 'var(--color-success)',
  '#10b981': 'var(--color-success)',
  '#16a34a': 'var(--color-success-dark)',
  '#15803d': 'var(--color-success-dark)',
  '#166534': 'var(--color-success-dark)',
  '#14532d': 'var(--color-success-dark)',
  '#dcfce7': 'var(--color-success-soft)',
  '#d1fae5': 'var(--color-success-light)',
  '#bbf7d0': 'var(--color-success-light)',
  '#f0fdf4': 'var(--color-success-soft)',
  '#86efac': 'var(--color-success-light)',

  // Ambers / warnings
  '#f59e0b': 'var(--color-warning)',
  '#fbbf24': 'var(--color-warning)',
  '#f97316': 'var(--color-warning)',
  '#ea580c': 'var(--color-warning-dark)',
  '#d97706': 'var(--color-warning-dark)',
  '#b45309': 'var(--color-warning-dark)',
  '#92400e': 'var(--color-warning-dark)',
  '#78350f': 'var(--color-warning-dark)',
  '#fef3c7': 'var(--color-warning-light)',
  '#fde68a': 'var(--color-warning-light)',
  '#fcd34d': 'var(--color-warning-light)',
  '#fffbeb': 'var(--color-warning-soft)',

  // Reds / danger
  '#ef4444': 'var(--color-danger)',
  '#dc2626': 'var(--color-danger)',
  '#b91c1c': 'var(--color-danger-dark)',
  '#991b1b': 'var(--color-danger-dark)',
  '#7f1d1d': 'var(--color-danger-dark)',
  '#fee2e2': 'var(--color-danger-light)',
  '#fecaca': 'var(--color-danger-light)',
  '#fca5a5': 'var(--color-danger-light)',
  '#fff5f5': 'var(--color-danger-soft)',
  '#fff8f8': 'var(--color-danger-soft)',
  '#fff1f2': 'var(--color-danger-soft)',
  '#fef2f2': 'var(--color-danger-soft)',
  '#fecdd3': 'var(--color-danger-light)',
  '#f87171': 'var(--color-danger)',

  // Blues / info / primary
  '#005fff': 'var(--color-primary)',
  '#2563eb': 'var(--color-primary-hover)',  // exact match in tokens.css
  '#3b82f6': 'var(--color-secondary)',
  '#60a5fa': 'var(--color-secondary)',
  '#1d4ed8': 'var(--color-info-dark)',
  '#1e40af': 'var(--color-info-dark)',
  '#1e3a8a': 'var(--color-info-dark)',
  '#dbeafe': 'var(--color-info-light)',
  '#bfdbfe': 'var(--color-info-light)',
  '#93c5fd': 'var(--color-info-light)',
  '#ecf4ff': 'var(--color-primary-soft)',
  '#eff6ff': 'var(--color-primary-soft)',
  // Sky / cyan family — folded into the secondary blue per FAP "blue only" rule.
  '#0ea5e9': 'var(--color-secondary)',
  '#0284c7': 'var(--color-info-dark)',
  '#06b6d4': 'var(--color-secondary)',
  '#0369a1': 'var(--color-info-dark)',
  '#0c4a6e': 'var(--color-info-dark)',
  '#075985': 'var(--color-info-dark)',
  '#bae6fd': 'var(--color-info-light)',
  '#7dd3fc': 'var(--color-info-light)',
  '#f0f9ff': 'var(--color-primary-soft)',
  '#e0f2fe': 'var(--color-info-light)',

  // Slates / neutrals
  '#475569': 'var(--color-neutral-fg)',
  '#64748b': 'var(--color-neutral-fg)',
  '#94a3b8': 'var(--color-text-soft)',
  '#0f172a': 'var(--color-text)',
  '#1e293b': 'var(--color-text)',
  '#334155': 'var(--color-text)',
  '#f1f5f9': 'var(--color-neutral-bg)',
  '#f8fafc': 'var(--color-neutral-bg)',
  '#e2e8f0': 'var(--color-border)',
  '#cbd5e1': 'var(--color-border-strong)',
  '#78716c': 'var(--color-neutral-fg)',  // stone-500 — warm-tone gray

  // Grays — text/border/surface
  '#1f2937': 'var(--color-text)',
  '#111827': 'var(--color-text)',
  '#374151': 'var(--color-text)',
  '#6b7280': 'var(--color-muted)',
  '#9ca3af': 'var(--color-text-soft)',
  '#d1d5db': 'var(--color-border-strong)',
  '#e5e7eb': 'var(--color-border)',
  '#f3f4f6': 'var(--color-surface-2)',
  '#ffffff': 'var(--color-surface)',
  '#fff': 'var(--color-surface)',

  // Canvas
  '#e1e7ef': 'var(--color-canvas)',

  // Violet (chart accent)
  '#8b5cf6': 'var(--chart-series-6)',
  '#7c3aed': 'var(--chart-series-6)',
  '#a78bfa': 'var(--chart-series-6)',
  '#6d28d9': 'var(--chart-series-6)',
  '#5b21b6': 'var(--chart-series-6)',
  '#f3e8ff': 'var(--color-info-light)',  // purple-100 → blue-100 per "blue only"
  '#ede9fe': 'var(--color-info-light)',
  '#ddd6fe': 'var(--color-info-light)',
  '#faf5ff': 'var(--color-primary-soft)',

  // Teal — folded into success per "blue only" + clinic of accents
  '#14b8a6': 'var(--color-success)',
  '#0f766e': 'var(--color-success-dark)',
  '#115e59': 'var(--color-success-dark)',
  '#ccfbf1': 'var(--color-success-light)',
  '#5eead4': 'var(--color-success-light)',

  // Pinks / fuchsias — folded into danger
  '#ec4899': 'var(--color-danger)',
  '#db2777': 'var(--color-danger-dark)',
  '#fce7f3': 'var(--color-danger-light)',

  // Black / off-black
  '#000000': 'var(--color-text)',
  '#000': 'var(--color-text)',
}

/* ─── walk ─────────────────────────────────────────────────────────────── */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (st.isFile() && /\.(vue|css)$/.test(entry) && !SKIP_FILES.has(entry)) out.push(p)
  }
  return out
}

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g
let totalReplaced = 0
const unresolved = []   // [{ file, line, literal }]
const filesChanged = []

for (const dir of SRC_DIRS) {
  const abs = join(ROOT, dir)
  for (const file of walk(abs)) {
    const original = readFileSync(file, 'utf8')
    let mutated = original
    let replacedInFile = 0
    const lineByOffset = (offset) => {
      let line = 1
      for (let i = 0; i < offset && i < original.length; i++) if (original[i] === '\n') line++
      return line
    }

    // Pass 1: collect unresolved hex literals (with line numbers from the
    // original text), then mutate via global replace using mapping table.
    for (const m of original.matchAll(HEX_RE)) {
      const lit = m[0].toLowerCase()
      if (MAPPING[lit] === undefined) {
        unresolved.push({ file: relative(ROOT, file), line: lineByOffset(m.index), literal: m[0] })
      }
    }

    // Pass 2: do the replacements.
    mutated = mutated.replace(HEX_RE, (raw) => {
      const lit = raw.toLowerCase()
      const repl = MAPPING[lit]
      if (repl === undefined) return raw
      replacedInFile++
      return repl
    })

    if (replacedInFile > 0) {
      writeFileSync(file, mutated)
      totalReplaced += replacedInFile
      filesChanged.push({ file: relative(ROOT, file), count: replacedInFile })
    }
  }
}

/* ─── report ───────────────────────────────────────────────────────────── */
const report = []
report.push(`# Hex → Token Migration Report`)
report.push(``)
report.push(`Generated: ${new Date().toISOString()}`)
report.push(`Files modified: ${filesChanged.length}`)
report.push(`Total replacements: ${totalReplaced}`)
report.push(`Unresolved literals: ${unresolved.length}`)
report.push(``)

if (filesChanged.length) {
  report.push(`## Files modified (descending replacement count)`)
  report.push(``)
  filesChanged
    .sort((a, b) => b.count - a.count)
    .forEach(({ file, count }) => report.push(`- ${file}: ${count}`))
  report.push(``)
}

if (unresolved.length) {
  // Group unresolved by literal and count, then by file.
  const byLit = new Map()
  for (const u of unresolved) {
    if (!byLit.has(u.literal)) byLit.set(u.literal, [])
    byLit.get(u.literal).push(`${u.file}:${u.line}`)
  }
  report.push(`## Unresolved hex literals (need manual mapping or removal)`)
  report.push(``)
  const sorted = [...byLit.entries()].sort((a, b) => b[1].length - a[1].length)
  for (const [lit, sites] of sorted) {
    report.push(`### \`${lit}\` (${sites.length} occurrences)`)
    sites.slice(0, 8).forEach((s) => report.push(`- ${s}`))
    if (sites.length > 8) report.push(`- … and ${sites.length - 8} more`)
    report.push(``)
  }
}

writeFileSync(join(ROOT, 'scripts/migration-report.md'), report.join('\n'))

console.log(`migrate-hex-to-tokens: replaced ${totalReplaced} literals across ${filesChanged.length} files`)
console.log(`migrate-hex-to-tokens: ${unresolved.length} unresolved literals; see scripts/migration-report.md`)
