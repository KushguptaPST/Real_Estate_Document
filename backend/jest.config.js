export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup/testEnv.cjs'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // Map the real JS file outside the backend dir before the generic stripper runs
    '^\\.\\./\\.\\./dateEngine\\.js$': '<rootDir>/../dateEngine.js',
    // For TypeScript files imported with .js extension (standard ts-jest ESM pattern)
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: './tsconfig.json',
      },
    ],
  },
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
};
