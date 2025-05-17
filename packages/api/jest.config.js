module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'], // Look for tests in the src directory
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // Setup files after env is setup but before tests run
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'], // Use <rootDir> for correct path
  // Coverage reporting
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts', // Don't collect from .d.ts files
    '!src/index.ts', // Usually, the main entry point might be excluded if it's just setup
    '!src/migrations/**', // Don't collect from migrations
    '!src/seeds/**',      // Don't collect from seeds
  ],
}; 