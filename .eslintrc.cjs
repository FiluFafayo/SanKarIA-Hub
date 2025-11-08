/*
 * Stage 6: Guard Siklus & Aturan Impor Antar Lapisan
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: ['plugin:@typescript-eslint/recommended'],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.ts', '.tsx']
      }
    }
  },
  rules: {
    // Cegah siklus impor
    'import/no-cycle': ['error', { ignoreExternal: true }],
  },
  overrides: [
    {
      files: ['components/**/*.ts', 'components/**/*.tsx', 'views/**/*.ts', 'views/**/*.tsx'],
      rules: {
        // UI tidak boleh mengimpor dataService langsung
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '../services/dataService',
                message: 'UI harus lewat repository layer (services/repository)'
              },
              {
                name: '../../services/dataService',
                message: 'UI harus lewat repository layer (services/repository)'
              },
              {
                name: 'services/dataService',
                message: 'UI harus lewat repository layer (services/repository)'
              }
            ]
          }
        ]
      }
    },
    {
      files: ['store/**/*.ts'],
      rules: {
        // Store tidak boleh mengimpor dataService langsung
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '../services/dataService',
                message: 'Store harus lewat repository layer (services/repository)'
              },
              {
                name: '../../services/dataService',
                message: 'Store harus lewat repository layer (services/repository)'
              },
              {
                name: 'services/dataService',
                message: 'Store harus lewat repository layer (services/repository)'
              }
            ]
          }
        ]
      }
    }
  ]
};