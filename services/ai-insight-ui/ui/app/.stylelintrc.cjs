/**
 * Stylelint config for the AI Insight UI.
 *
 * Bans raw hex/rgba/hsla values in color-bearing properties so every view
 * routes through the centralized tokens in src/styles/tokens.css. tokens.css
 * itself is exempt — it owns the canonical literals.
 *
 * Severity is 'warning' until Phase 2c migration completes, at which point
 * this flips to 'error' + --max-warnings 0 in CI.
 */
/** @type {import('stylelint').Config} */
module.exports = {
  extends: [
    'stylelint-config-recommended',
    'stylelint-config-recommended-vue',
  ],
  rules: {
    'color-no-hex': [true, { severity: 'warning' }],
    'declaration-property-value-disallowed-list': [
      {
        '/^(color|background|background-color|border|border-color|outline|outline-color|fill|stroke)$/':
          ['/#[0-9a-fA-F]{3,8}\\b/', '/\\brgba?\\(/', '/\\bhsla?\\(/'],
      },
      { severity: 'warning' },
    ],
    // Defaults from stylelint-config-recommended that aren't useful here:
    'no-descending-specificity': null,
    'no-duplicate-selectors': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'shorthand-property-no-redundant-values': null,
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['deep', 'global', 'slotted'] }],
    'at-rule-no-unknown': [true, { ignoreAtRules: ['tailwind', 'apply', 'variants', 'responsive', 'screen'] }],
    // Pre-existing code-quality issues; downgrade to warning so Phase 1 lint
    // setup doesn't block on them. Phase 2 manual review will clean these up.
    'block-no-empty': [true, { severity: 'warning' }],
    'declaration-block-no-duplicate-properties': [true, { severity: 'warning' }],
  },
  ignoreFiles: [
    'src/styles/tokens.css',
    'dist/**',
    'node_modules/**',
    'public/**',
  ],
}
