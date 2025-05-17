// packages/api/src/test-setup.ts

// Mock environment variables for testing
process.env.SPOTIFY_CLIENT_ID = 'test_spotify_client_id';
process.env.SPOTIFY_CLIENT_SECRET = 'test_spotify_client_secret';
process.env.SESSION_SECRET = 'test_session_secret';
process.env.API_PORT = '3002'; // Use a different port for testing if needed, or mock it if app starts listening
process.env.NODE_ENV = 'test';

// Mock the Knex instance (db)
// This is a basic mock. You might want to make it more sophisticated
// using jest.fn() for specific table methods if your tests need to verify
// specific database calls.

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(null), // Default to finding no user/item
  insert: jest.fn().mockResolvedValue([1]), // Default to successful insert returning an ID
  update: jest.fn().mockResolvedValue(1),   // Default to successful update
  increment: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  raw: jest.fn().mockResolvedValue([]),
  fn: {
    now: jest.fn().mockReturnValue(new Date().toISOString()),
  },
  // Add any other Knex functions your app uses
  initialize: jest.fn(),
  migrate: {
    latest: jest.fn().mockResolvedValue([]),
    rollback: jest.fn().mockResolvedValue([]),
  },
  seed: {
    run: jest.fn().mockResolvedValue([]),
  },
};

// Now, we need to ensure that when ../index.ts (or other files) try to import and use `db`,
// they get this mockDb instance. We can use jest.mock for this.

jest.mock('knex', () => {
  const actualKnex = jest.requireActual('knex');
  return {
    ...actualKnex, // Preserve other exports like actualKnex.Knex if needed
    default: jest.fn(() => mockDb), // Mock the default export (knexConstructor)
  };
});

// You might need to clear these mocks before/after each test if they accumulate state
beforeEach(() => {
  // Reset all mock function calls if needed, but be careful if some setup is global
  // mockDb.select.mockClear();
  // mockDb.where.mockClear();
  // mockDb.first.mockClear().mockResolvedValue(null); // Reset to default behavior
  // mockDb.insert.mockClear().mockResolvedValue([1]);
  Object.values(mockDb).forEach(mockFn => {
    if (typeof mockFn === 'function' && 'mockClear' in mockFn) {
      mockFn.mockClear();
    }
  });
  // Reset first() to its default mock behavior if it's commonly changed in tests
  mockDb.first.mockResolvedValue(null);
  mockDb.insert.mockResolvedValue([1]);
});

// Global test setup can go here, e.g., for database before all tests
/*
beforeAll(async () => {
  // If using a real test database (not fully mocked db like above):
  // await db.migrate.latest();
  // await db.seed.run();
});

afterAll(async () => {
  // await db.destroy(); // Close db connection if applicable
});
*/

export { mockDb }; // Export mockDb if tests need to directly manipulate it 