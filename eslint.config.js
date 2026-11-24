import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const coreBoundary =
  'The core must not depend on rendering, interface or server code (see docs/adr/0007-core-independent-of-rendering.md).';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '.local/**', 'tools/**', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'three',
                'three/*',
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                'hono',
                'hono/*',
                '@idontknot/*',
              ],
              message: coreBoundary,
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'document', message: coreBoundary },
        { name: 'window', message: coreBoundary },
      ],
    },
  },
);
