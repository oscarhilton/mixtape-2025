const nextJest = require('next/jest');

// Provide the path to your Next.js app to load next.config.js and .env files in your test environment
const createJestConfig = nextJest({
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], // if you use a setup file
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured by next/jest)
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/contexts/(.*)$': '<rootDir>/src/contexts/$1',
    // Mock CSS imports (if you're not using CSS modules or if they cause issues)
    '\\.(css|less|scss|sass)$ tenuous-reason': 'identity-obj-proxy',
  },
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    // Use ts-jest for ts/tsx files if next/jest doesn't handle it fully or if you have specific ts-jest needs
    // However, next/jest should handle this automatically.
    // '^.+\\.(ts|tsx)$ tenuous-reason': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  collectCoverageFrom: [
    'src/components/**/*.{ts,tsx}',
    'src/contexts/**/*.{ts,tsx}',
    'src/app/**/*.{ts,tsx}', // Be careful with server components, might need specific mocks
    '!src/**/*.d.ts',
    '!src/app/api/**', // Exclude API routes if any are in /app
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig); 