// Root-level Jest config — only runs dateEngine.test.js
// Backend and frontend have their own Jest configs inside their directories.
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
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
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/backend/', '/frontend/', '/reference/'],
};
