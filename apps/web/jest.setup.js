import '@testing-library/jest-dom';

// Mock environment variables for frontend tests
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001'; // Or a mock server URL

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    // Add other router methods if your components use them
  }),
  usePathname: jest.fn(() => '/'), // Default mock pathname
  // Mock other exports from next/navigation if needed
}));

// Mock window.location.href for login redirect
// Store the original window.location
const originalLocation = window.location;

beforeAll(() => {
  delete window.location;
  window.location = Object.assign(new URL("http://localhost:3000"), {
    ancestorOrigins: "",
    assign: jest.fn(),
    reload: jest.fn(),
    replace: jest.fn(),
    href: "http://localhost:3000/", // initial href
  });
});

afterAll(() => {
  // Restore the original window.location
  window.location = originalLocation;
});

beforeEach(() => {
  // Reset mocks that might be called multiple times
  if (window.location.assign.mockReset) {
    window.location.assign.mockReset();
  }
  window.location.href = "http://localhost:3000/"; // Reset href before each test

  // Clear router mocks
  const { useRouter } = require('next/navigation');
  const router = useRouter();
  router.push.mockClear();
  router.replace.mockClear();
  router.refresh.mockClear();
});

// You might also want to mock `fetch` globally if many components use it directly
// and you want to control responses, though for AuthContext it's already part of the unit under test.
/*
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ user: null }), // Default to not authenticated
  })
);
*/ 