import request from "supertest";
// We need to import the app instance from our index.ts, but we need to be careful
// as index.ts starts the server by calling app.listen().
// For testing, we typically want to export the app without it listening,
// or have a way to get the app instance before listen() is called.

// Let's modify index.ts slightly to export the app for testing purposes
// For now, this test will be simple and might need adjustment after index.ts is modified.

// A placeholder test that we will refine:
declare global {
  namespace NodeJS {
    interface Global {
      expressApp: any; // Placeholder for the app instance
    }
  }
}

// This is a temporary structure. We will properly import the app later.
// For now, let's assume we can get the app instance somehow, or test a dummy app.

// A simple test to check Jest setup, will be adapted
describe("Initial App Test", () => {
  it("should always pass to confirm Jest setup", () => {
    expect(true).toBe(true);
  });
});

// We will need to refactor index.ts to properly export the 'app' instance for testing.
// Once that's done, we can write tests like:
import app from "../index"; // Import the configured Express app

describe("GET / - API Root", () => {
  it("should return Hello from the API!", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toEqual(200);
    expect(res.text).toBe("Hello from the API!");
  });
});

// Example for a non-existent route to test 404 handling from Express itself
// (if not caught by a more specific error handler you added)
describe("GET /nonexistentroute - Non-existent route", () => {
  it("should return 404", async () => {
    const res = await request(app).get("/nonexistentroute");
    expect(res.statusCode).toEqual(404);
  });
});
