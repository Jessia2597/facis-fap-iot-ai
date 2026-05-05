/**
 * ESLint flat config for the AI Insight UI.
 *
 * The transport-contract rule (no-restricted-imports against
 * @/services/api) lives at 'warn' severity during Phase 3 view
 * migration, then flips to 'error' in Phase 3c when api.ts is deleted.
 */
import vue from 'eslint-plugin-vue'
import vueTsConfig from '@vue/eslint-config-typescript'

export default [
  ...vue.configs['flat/recommended'],
  ...vueTsConfig(),
  {
    files: ['src/**/*.{vue,ts,tsx}'],
    rules: {
      // Phase-3 transport-contract guard. View/component code must reach
      // ORCE through @/services/transport submit(); it must not pull in
      // the legacy @/services/api wrappers (which themselves are being
      // deleted in Phase 3c).
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: [
                '@/services/api',
                './services/api',
                '../services/api',
                '../../services/api',
                '../../../services/api',
              ],
              message: 'Use @/services/transport submit() directly. api.ts is being phased out (Phase 3).',
            },
          ],
        },
      ],
      // Vue defaults that fight the existing codebase:
      'vue/multi-word-component-names': 'off',
      'vue/attributes-order': 'warn',
      'vue/order-in-components': 'warn',
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // services/ is exempt from the api-import ban — api.ts itself lives there.
  {
    files: ['src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**', '*.config.js', '*.config.ts'],
  },
]
