import request from "supertest";
import app from "../index"; // Our Express app
import { mockDb } from "../test-setup"; // To control DB responses

// Mock passport and its authenticate method
// We need to mock specific strategies or the authenticate call itself
const mockPassportAuthenticate = jest.fn();
const mockReqLogin = jest.fn((user, cb) => cb());
const mockReqLogout = jest.fn((cb) => cb());

jest.mock("passport", () => ({
  ...jest.requireActual("passport"),
  authenticate: (...args: any[]) => {
    // This allows us to check what authenticate was called with (e.g. 'spotify')
    // and then decide how the middleware it returns should behave.
    mockPassportAuthenticate(...args); // Call our mock function to track calls

    // It needs to return a middleware function (req, res, next) => {}
    // This middleware is what Passport typically provides.
    // For testing, we can make it simulate success or failure.
    return (req: any, res: any, next: any) => {
      // Simulate successful authentication for callback tests by attaching a user
      // This part needs to be more dynamic based on the test scenario.
      if (args[1]?.successRedirect || args[1]?.failureRedirect) {
        // Likely a callback
        if (
          mockPassportAuthenticate.mock.calls.some(
            (call) => call[1]?.simulateSuccess,
          )
        ) {
          req.user = {
            id: 1,
            spotify_id: "mockspotifyid",
            display_name: "Mock User",
          };
          req.login = mockReqLogin; // Attach mock login
        }
      }
      next(); // Proceed to the next middleware (our route handler or error)
    };
  },
  initialize: () => (req: any, res: any, next: any) => next(), // Mock initialize
  session: () => (req: any, res: any, next: any) => next(), // Mock session
}));

describe("Auth Routes", () => {
  beforeEach(() => {
    mockPassportAuthenticate.mockClear();
    mockReqLogin.mockClear();
    mockReqLogout.mockClear();
    // Reset any specific mockDb behaviors if needed for auth tests
    mockDb.first.mockResolvedValue(null); // Default: user not found
    mockDb.insert.mockResolvedValue([1]); // Default: user insert success
  });

  describe("GET /auth/spotify", () => {
    it("should attempt to authenticate with Spotify", async () => {
      await request(app).get("/auth/spotify");
      // Check if passport.authenticate was called with 'spotify'
      expect(mockPassportAuthenticate).toHaveBeenCalledWith(
        "spotify",
        expect.anything(),
      );
    });
  });

  describe("GET /auth/spotify/callback", () => {
    it("should redirect to frontend on successful authentication", async () => {
      // Simulate that passport.authenticate will succeed by setting a flag or a more complex mock
      // For this setup, we'll rely on the mock implementation of passport.authenticate
      // to call req.logIn and attach req.user if it was a successful mock call.
      mockPassportAuthenticate.mockImplementation((strategy, options) => {
        return (req: any, res: any, next: any) => {
          req.user = {
            id: 1,
            spotify_id: "testuser",
            display_name: "Test User",
          };
          req.login = mockReqLogin; // Make sure req.login is available and is a mock
          // Simulate passport calling req.logIn successfully
          mockReqLogin(req.user, (err: any) => {
            if (err) return next(err);
            // Simulate successful login and session establishment before handler
            // In a real scenario, passport.authenticate middleware handles this based on strategy result
            next();
          });
        };
      });

      const mockUser = {
        id: 1,
        spotify_id: "user123",
        display_name: "Callback User",
      };
      mockDb.first.mockResolvedValueOnce(mockUser); // Simulate user found or created

      const response = await request(app).get("/auth/spotify/callback");

      expect(mockPassportAuthenticate).toHaveBeenCalledWith("spotify", {
        failureRedirect: "/login-failed",
      });
      expect(mockReqLogin).toHaveBeenCalled(); // Check if req.login was called by passport (simulated here)
      expect(response.statusCode).toBe(302); // Redirect
      expect(response.headers.location).toBe("http://localhost:3000/");
    });

    it("should redirect to failure page on failed authentication", async () => {
      mockPassportAuthenticate.mockImplementation((strategy, options) => {
        // This is the middleware returned by passport.authenticate
        return (req: any, res: any, next: any) => {
          // Simulate authentication failure by redirecting to options.failureRedirect
          // This is a simplified simulation. In reality, the strategy would call fail().
          if (options.failureRedirect) {
            return res.redirect(options.failureRedirect);
          }
          next(new Error("Authentication failed simulation"));
        };
      });

      const response = await request(app).get("/auth/spotify/callback");
      expect(response.statusCode).toBe(302); // Redirect
      expect(response.headers.location).toBe("/login-failed");
    });
  });

  describe("GET /auth/me", () => {
    it("should return user info if authenticated", async () => {
      const mockUser = {
        id: 1,
        spotify_id: "testuser",
        display_name: "Test User",
      };
      // Supertest agent to maintain session
      const agent = request.agent(app);

      // Simulate login: a bit tricky without a full login flow, so we mock session state
      // For a more robust way, you'd hit a login endpoint that sets up the session.
      // Here, we'll rely on the deserializeUser mock in test-setup or mock req.isAuthenticated directly.
      app.use((req, res, next) => {
        // Temporary middleware to mock authentication
        (req as any).isAuthenticated = () => true;
        (req as any).user = mockUser;
        next();
      });

      const response = await agent.get("/auth/me");
      expect(response.statusCode).toBe(200);
      expect(response.body.user).toEqual(mockUser);

      // Clean up the temporary middleware (not ideal, better to mock at passport level)
      // This type of direct app modification is usually avoided in tests.
      // Consider a helper function for authenticated requests if this pattern repeats.
      (app as any)._router.stack.pop();
    });

    it("should return 401 if not authenticated", async () => {
      app.use((req, res, next) => {
        // Temporary middleware to mock NO authentication
        (req as any).isAuthenticated = () => false;
        (req as any).user = null;
        next();
      });

      const response = await request(app).get("/auth/me");
      expect(response.statusCode).toBe(401);
      expect(response.body.message).toBe("Not authenticated");
      (app as any)._router.stack.pop();
    });
  });

  describe("GET /auth/logout", () => {
    it("should logout the user and redirect or send success message", async () => {
      const agent = request.agent(app);
      // First, simulate a logged-in state (e.g. by hitting a mock login or setting session)
      // For simplicity, we assume req.logout is available on a mock user session
      app.use((req, res, next) => {
        (req as any).session = { destroy: (cb: any) => cb() }; // Mock session.destroy
        (req as any).logout = mockReqLogout; // Use our mock for req.logout
        (req as any).clearCookie = jest.fn();
        next();
      });

      const response = await agent.get("/auth/logout");
      expect(mockReqLogout).toHaveBeenCalled();
      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe("Logged out successfully");
      expect(
        (app as any)._router.stack[(app as any)._router.stack.length - 1].handle
          .clearCookie,
      ).toHaveBeenCalledWith("connect.sid");
      (app as any)._router.stack.pop();
    });
  });
});
