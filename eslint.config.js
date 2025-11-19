import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';

export default [
  js.configs.recommended,
  jsdoc.configs['flat/recommended'],
  {
    plugins: {
      jsdoc
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        File: 'readonly',
      }
    },
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': 'off',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'indent': ['error', 2],
      'comma-dangle': ['error', 'only-multiline'],
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always'],
      'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 0 }],

      // JSDoc rules
      'jsdoc/require-jsdoc': ['warn', {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
          ArrowFunctionExpression: false,
          FunctionExpression: true
        },
        contexts: [
          'ExportNamedDeclaration > FunctionDeclaration',
          'ExportNamedDeclaration > VariableDeclaration'
        ]
      }],
      'jsdoc/require-param': 'warn',
      'jsdoc/require-param-type': 'warn',
      'jsdoc/require-returns': 'warn',
      'jsdoc/require-returns-type': 'warn',
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-returns-description': 'warn',
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-types': 'warn',
      'jsdoc/valid-types': 'warn',
      'jsdoc/check-tag-names': ['warn', { definedTags: ['browserSafe'] }],
      'jsdoc/no-undefined-types': 'off', // Allow custom types from typedef
    }
  },
  {
    ignores: [
      'node_modules/**',
      'sample/**',
      'test/local-sample/temp/**',
      'fixts-webapp/**',
      'fixts-desktop/**',
      'fixts-desktop/dist-electron/**',
      'docs/api/**'  // Auto-generated JSDoc files
    ]
  }
];
