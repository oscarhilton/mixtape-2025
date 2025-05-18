import express, { Request, Response, NextFunction, RequestHandler } from "express";
import cors from "cors";
import dotenv from "dotenv";
import knexConstructor from "knex";
import session from "express-session";
import passport from "passport";
import {
  Strategy as SpotifyStrategy,
  Profile as SpotifyProfile,
} from "passport-spotify";
// @ts-ignore
import knexfile from "../knexfile"; // Using knexfile.js which is CommonJS
import fetch from "node-fetch"; // Added for Spotify API calls
import { URLSearchParams } from "url"; // Added for token request
import playlistRoutes from "./routes/playlistRoutes";
import { isAuthenticated } from "./middleware/authMiddleware"; // Assuming you have this

dotenv.config();

const app = express();
const port = process.env.API_PORT || 3001;

// Use the correct database configuration based on environment
const db = knexConstructor(
  process.env.NODE_ENV === 'production' ? knexfile.production : knexfile.development
);

// Spotify Access Token Cache (Client Credentials Flow)
let spotifyAccessToken: string | null = null;
let spotifyTokenExpiresAt: number | null = null;

async function getSpotifyAccessToken(): Promise<string | null> {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error(
      "Spotify Client ID or Secret not configured for server-to-server auth.",
    );
    return null;
  }
  try {
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.SPOTIFY_CLIENT_ID +
              ":" +
              process.env.SPOTIFY_CLIENT_SECRET,
          ).toString("base64"),
      },
      body: params,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "Failed to fetch Spotify access token:",
        response.status,
        errorBody,
      );
      throw new Error(`Spotify token API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    spotifyAccessToken = data.access_token;
    // Set expiry time with a small buffer (e.g., 60 seconds) before actual expiry
    spotifyTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    console.log("Successfully fetched new Spotify server access token.");
    return spotifyAccessToken;
  } catch (error) {
    console.error("Error fetching Spotify access token:", error);
    spotifyAccessToken = null;
    spotifyTokenExpiresAt = null;
    return null;
  }
}

async function getValidSpotifyToken(): Promise<string | null> {
  if (
    spotifyAccessToken &&
    spotifyTokenExpiresAt &&
    Date.now() < spotifyTokenExpiresAt
  ) {
    return spotifyAccessToken;
  }
  // Token is invalid or expired, fetch a new one
  return getSpotifyAccessToken();
}

// Helper function to refresh user's Spotify access token if needed
async function getRefreshedUserSpotifyToken(
  req: express.Request,
): Promise<string | null> {
  if (!req.session || !req.session.spotifyRefreshToken) {
    console.error("[TokenRefresh] No refresh token in session.");
    return null;
  }

  // Check if token is expired or close to expiry (e.g., within 5 minutes)
  const fiveMinutesInMs = 5 * 60 * 1000;
  if (
    req.session.spotifyTokenExpiresAt &&
    req.session.spotifyTokenExpiresAt - Date.now() > fiveMinutesInMs &&
    req.session.spotifyAccessToken
  ) {
    console.log("[TokenRefresh] Current access token is still valid.");
    return req.session.spotifyAccessToken;
  }

  console.log(
    "[TokenRefresh] Access token expired or nearing expiry. Attempting refresh.",
  );
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error(
      "[TokenRefresh] Spotify client ID or secret not configured for token refresh.",
    );
    return null; // Cannot refresh without client credentials
  }

  try {
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", req.session.spotifyRefreshToken);

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString(
            "base64",
          ),
      },
      body: params,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "[TokenRefresh] Failed to refresh Spotify access token:",
        response.status,
        errorBody,
      );
      // If refresh fails (e.g. bad refresh token), we might need to clear session tokens / re-authenticate user
      // For now, just return null, the caller should handle this (e.g. by sending 401)
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    req.session.spotifyAccessToken = data.access_token;
    req.session.spotifyTokenExpiresAt = Date.now() + data.expires_in * 1000;
    // Spotify might return a new refresh token, update if it does
    if (data.refresh_token) {
      req.session.spotifyRefreshToken = data.refresh_token;
    }

    // Explicitly save the session after updating tokens
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error(
            "[TokenRefresh] Error saving session after token refresh:",
            err,
          );
          return reject(err);
        }
        console.log(
          "[TokenRefresh] Successfully refreshed token and saved to session.",
        );
        resolve();
      });
    });

    return req.session.spotifyAccessToken;
  } catch (error) {
    console.error("[TokenRefresh] Error during token refresh process:", error);
    return null;
  }
}

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback_secret_for_development",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax"
    }
  })
);

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await db("users").where({ id }).first();
    done(null, user);
  } catch (err: any) {
    done(err, null);
  }
});

if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.error(
    "ERROR: Spotify Client ID or Secret not configured in .env file!",
  );
} else {
  passport.use(
    new SpotifyStrategy(
      {
        clientID: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        callbackURL: `http://localhost:${port}/auth/spotify/callback`,
        scope: [
          "user-read-email",
          "user-read-private",
          "playlist-read-private",
          "streaming",
          "user-modify-playback-state",
          "user-read-playback-state",
        ],
        passReqToCallback: true,
      },
      (async (
        req: express.Request,
        accessToken: string,
        refreshToken: string,
        expires_in: number,
        profile: SpotifyProfile,
        done: (error: any, user?: any) => void,
      ) => {
        try {
          req.spotifyAuthDetails = {
            accessToken,
            refreshToken,
            tokenExpiresAt: Date.now() + expires_in * 1000,
          };

          if (!profile || !profile.id) {
            return done(new Error("Spotify profile ID is missing"));
          }

          let user = await db("users")
            .where({ spotify_id: profile.id })
            .first();

          if (user) {
            return done(null, user);
          } else {
            const [newUserId] = await db("users").insert({
              spotify_id: profile.id,
              display_name: profile.displayName || profile.username || "Spotify User",
              email: profile.emails && profile.emails.length > 0
                ? profile.emails[0].value
                : null,
            });

            user = await db("users").where({ id: newUserId }).first();
            return done(null, user);
          }
        } catch (err: any) {
          return done(err);
        }
      }) as unknown as (...args: any[]) => void
    )
  );
}

// CORS and JSON middleware
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3002"],
    credentials: true,
  }),
);
app.use(express.json());

// Error handling middleware
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Mount playlist routes
app.use('/api/playlists', playlistRoutes);

// Auth Routes
app.get("/auth/spotify", passport.authenticate("spotify"));

app.get(
  "/auth/spotify/callback",
  passport.authenticate("spotify", {
    failureRedirect: "/auth/login-failed",
  }),
  (req: Request, res: Response) => {
    console.log("[SpotifyCallback] Auth details:", req.spotifyAuthDetails ? "Present" : "Missing");
    // Store the Spotify tokens in the session
    if (req.spotifyAuthDetails) {
      console.log("[SpotifyCallback] Saving tokens to session");
      req.session.spotifyAccessToken = req.spotifyAuthDetails.accessToken;
      req.session.spotifyRefreshToken = req.spotifyAuthDetails.refreshToken;
      req.session.spotifyTokenExpiresAt = req.spotifyAuthDetails.tokenExpiresAt;
      req.session.save((err) => {
        if (err) {
          console.error("[SpotifyCallback] Error saving session:", err);
        } else {
          console.log("[SpotifyCallback] Successfully saved tokens to session");
        }
      });
    } else {
      console.error("[SpotifyCallback] No auth details available to save");
    }
    res.redirect("http://localhost:3000/");
  }
);

// Existing route to handle login failures
app.get("/auth/login-failed", (req, res) => {
  const messages = req.session?.messages || [];
  console.error("[LoginFailed] Authentication failed. Messages:", messages);
  // Clear any messages if you only want to show them once
  if (req.session) req.session.messages = [];
  res.status(401).json({
    message: "Spotify authentication failed.",
    details: messages,
  });
});

app.get("/auth/logout", (req, res, next) => {
  req.logout((err: any) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((destroyErr: any) => {
      if (destroyErr) {
        return next(destroyErr);
      }
      res.clearCookie("connect.sid"); // Clears the session cookie
      res.status(200).json({ message: "Logged out successfully" });
    });
  });
});

// Endpoint to check current user session
app.get("/auth/me", (req: express.Request, res: express.Response) => {
  console.log("[AuthMe] Session content:", req.session);
  console.log("[AuthMe] Is authenticated:", req.isAuthenticated());
  console.log("[AuthMe] User:", req.user);
  console.log("[AuthMe] Access token present:", !!req.session?.spotifyAccessToken);
  
  if (req.isAuthenticated() && req.user && req.session) {
    const userObject = req.user as any;
    const response = {
      user: userObject,
      accessToken: req.session.spotifyAccessToken
    };
    console.log("[AuthMe] Sending response:", {
      ...response,
      accessToken: response.accessToken ? "Present" : "Missing"
    });
    res.json(response);
  } else {
    console.log("[AuthMe] Not authenticated or missing session/user");
    res.status(401).json({ message: "Not authenticated" });
  }
});

// Spotify API Proxy Routes (using server-side token)
app.get(
  "/spotify/playlist-name/:playlistId",
  asyncHandler(async (req: Request, res: Response) => {
    const { playlistId } = req.params;
    const token = await getValidSpotifyToken();
    if (!token) {
      return res
        .status(503)
        .json({ message: "Could not retrieve Spotify API token." });
    }
    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}?fields=name`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Spotify API error for playlist name ${playlistId}: ${response.status}`,
        errorBody,
      );
      return res.status(response.status).json({
        message: "Failed to fetch playlist name from Spotify.",
        details: errorBody,
      });
    }
    const data = (await response.json()) as { name: string };
    res.json({ name: data.name });
  })
);

app.get(
  "/spotify/playlist/:playlistId/tracks",
  asyncHandler(async (req: Request, res: Response) => {
    const { playlistId } = req.params;
    const token = await getValidSpotifyToken();
    if (!token) {
      return res.status(503).json({
        message: "Could not retrieve Spotify API token for server.",
      });
    }
    const fields = "items(track(id,name,artists(name),album(name,images),uri,duration_ms))";
    const limit = 50;
    let offset = 0;
    let allTracks: any[] = [];
    let hasMore = true;
    while (hasMore) {
      const response = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=${fields}&limit=${limit}&offset=${offset}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(
          `Spotify API error for playlist tracks ${playlistId}: ${response.status}`,
          errorBody,
        );
        if (response.status === 404) {
          return res.status(404).json({
            message: `Playlist with ID ${playlistId} not found on Spotify.`,
            details: errorBody,
          });
        }
        return res.status(response.status).json({
          message: "Failed to fetch playlist tracks from Spotify.",
          details: errorBody,
        });
      }
      const pageData = (await response.json());
      if (pageData.items) {
        allTracks = allTracks.concat(
          pageData.items.map((item: any) => item.track).filter((track: any) => track),
        );
      }
      if (pageData.next) {
        offset += limit;
      } else {
        hasMore = false;
      }
      if (offset > (pageData.total || 500) + limit) {
        console.warn(
          `[Spotify Tracks] Exceeded expected offset for playlist ${playlistId}. Total items: ${pageData.total}, current offset: ${offset}. Breaking loop.`,
        );
        hasMore = false;
      }
      if (
        !pageData.items ||
        (pageData.items.length === 0 && pageData.next)
      ) {
        console.warn(
          `[Spotify Tracks] No items returned but 'next' URL present for playlist ${playlistId}. Offset: ${offset}. Breaking loop.`,
        );
        hasMore = false;
      }
    }
    res.json(allTracks);
  })
);

// Playlist Routes
app.get("/", ((req, res) => {
  res.send("Hello from the API!");
}) as RequestHandler);

// Comment Routes
// Create a new comment on a track in a playlist
app.post(
  "/comments",
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "User not authenticated." });
    }
    const { playlist_id, track_uri, timestamp_ms, comment_text } = req.body;
    const user_id = (req.user as any).id;
    if (
      !playlist_id ||
      !track_uri ||
      timestamp_ms === undefined ||
      !comment_text
    ) {
      return res.status(400).json({
        message:
          "Missing required fields: playlist_id, track_uri, timestamp_ms, comment_text.",
      });
    }
    const playlist = await db("playlists").where({ id: playlist_id }).first();
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found." });
    }
    const newComment = {
      playlist_id,
      user_id,
      track_uri,
      timestamp_ms,
      comment_text,
    };
    const [newCommentId] = await db("playlist_track_comments").insert(
      newComment,
    );
    const createdComment = await db("playlist_track_comments")
      .where({ id: newCommentId })
      .first();
    res.status(201).json(createdComment);
  })
);

// Get all comments for a specific playlist
app.get(
  "/playlists/:playlistId/comments",
  asyncHandler(async (req: Request, res: Response) => {
    const { playlistId } = req.params;
    const playlist = await db("playlists").where({ id: playlistId }).first();
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found." });
    }
    const comments = await db("playlist_track_comments")
      .where({ playlist_id: playlistId })
      .orderBy("created_at", "asc");
    res.json(comments);
  })
);

// Augment Express's User type
declare global {
  namespace Express {
    export interface User {
      id?: string; // Or number, depending on your DB user ID type
      // Add any other properties your user object will have from Passport
    }
  }
}

// New endpoint for saving recordings
app.post("/api/recordings", isAuthenticated, async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      res.status(401).json({ message: "User not authenticated or user ID missing." });
      return;
    }
    const userId = req.user.id;
    const { segments, name: recordingName } = req.body; // Allow an optional name for the recording

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      res.status(400).json({ message: "Segments data is missing or invalid." });
      return;
    }

    console.log(`[API /api/recordings] Received ${segments.length} segments for user ID: ${userId}. Name: ${recordingName || 'Untitled'}`);
    // console.log("[API /api/recordings] Segments data:", JSON.stringify(segments, null, 2)); // Can be very verbose

    // Database saving logic with Knex
    const newRecordingId = await db.transaction(async (trx) => {
      const insertResults = await trx("recordings")
        .insert({
          user_id: userId,
          name: recordingName || `Recording ${new Date().toISOString()}`, // Default name
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning("id");
      
      let actualRecordingId;
      if (insertResults && insertResults.length > 0) {
        const firstItem = insertResults[0];
        // Check if the first item is an object with an 'id' property (like from PostgreSQL)
        if (typeof firstItem === 'object' && firstItem !== null && 'id' in firstItem) {
          actualRecordingId = firstItem.id;
        } else {
          // Assume it's the ID directly (like from SQLite returning [123] or just 123 from .returning())
          actualRecordingId = firstItem;
        }
      }

      if (!actualRecordingId) {
        console.error("[API /api/recordings] Critical: Failed to obtain recording ID after insert. Insert results:", insertResults);
        // It's crucial to throw to trigger transaction rollback
        throw new Error("Database operation failed: Could not retrieve ID for new recording. Please check API server logs and database integrity for the 'recordings' table.");
      }

      const segmentsToInsert = segments.map((segment: any) => ({
        recording_id: actualRecordingId, // Use the validated ID
        type: segment.type,
        session_start_ms: segment.sessionStartMs,
        duration_ms: segment.durationMs,
        track_id: segment.trackId,
        track_start_ms: segment.trackStartMs,
        track_end_ms: segment.trackEndMs,
        created_at: db.fn.now(),
      }));

      await trx("recording_segments").insert(segmentsToInsert);
      return actualRecordingId; // Return the validated ID
    });

    res.status(201).json({
      message: "Recording saved successfully.",
      recordingId: newRecordingId,
      userId: userId,
      segmentCount: segments.length,
    });

  } catch (error) {
    console.error("[API /api/recordings] Error processing recording:", (error instanceof Error) ? error.message : error);
    next(error); // Pass error to the centralized error handler
  }
});

// New endpoint for fetching recordings for the authenticated user
app.get("/api/recordings", isAuthenticated, async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      res.status(401).json({ message: "User not authenticated or user ID missing." });
      return;
    }
    const userId = req.user.id;

    console.log(`[API /api/recordings] Fetching recordings for user ID: ${userId}`);

    const recordings = await db("recordings")
      .where({ user_id: userId })
      .orderBy("created_at", "desc")
      .select("*"); // Select all columns for the recording

    // Optionally, for each recording, you could also fetch its segments or a segment count
    // For simplicity here, just returning the recordings list.
    // To include segments:
    // const recordingsWithSegments = await Promise.all(recordings.map(async (rec) => {
    //   const segments = await db("recording_segments").where({ recording_id: rec.id }).select("*");
    //   return { ...rec, segments };
    // }));

    res.status(200).json(recordings);

  } catch (error) {
    console.error("[API /api/recordings GET] Error fetching recordings:", (error instanceof Error) ? error.message : error);
    next(error);
  }
});

// Spotify Playback Proxy (using USER's session token)
app.put(
  "/spotify/play",
  isAuthenticated,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    console.log(
      "[API /spotify/play] Received request:",
      {
        body: req.body,
        isAuthenticated: req.isAuthenticated(),
        hasUser: !!req.user,
        session: {
          hasAccessToken: !!req.session?.spotifyAccessToken,
          hasRefreshToken: !!req.session?.spotifyRefreshToken,
        }
      }
    );

    if (!req.isAuthenticated() || !req.user) {
      console.error("[API /spotify/play] User not authenticated");
      return res.status(401).json({ message: "User not authenticated." });
    }

    const userSpotifyToken = await getRefreshedUserSpotifyToken(req);
    console.log("[API /spotify/play] Token refresh result:", {
      hasToken: !!userSpotifyToken,
      tokenLength: userSpotifyToken?.length
    });

    if (!userSpotifyToken) {
      console.error("[API /spotify/play] No valid Spotify token available");
      return res.status(401).json({
        message: "Spotify access token missing or failed to refresh. Please re-login.",
      });
    }

    const { device_id, context_uri, uris, offset, position_ms } = req.body;
    console.log("[API /spotify/play] Playback request details:", {
      device_id,
      context_uri,
      uris,
      offset,
      position_ms
    });

    if (!device_id) {
      console.error("[API /spotify/play] Missing device_id in request");
      return res.status(400).json({ message: "Device ID is required." });
    }

    const spotifyPlayBody: any = {};
    if (offset) spotifyPlayBody.offset = offset;
    if (typeof position_ms === "number") spotifyPlayBody.position_ms = position_ms;

    if (context_uri) {
      spotifyPlayBody.context_uri = context_uri;
    } else if (uris && uris.length > 0) {
      spotifyPlayBody.uris = uris;
    } else {
      console.error("[API /spotify/play] Missing playback context");
      return res.status(400).json({
        message: "Either context_uri or uris must be provided to start playback.",
      });
    }

    const spotifyApiUrl = `https://api.spotify.com/v1/me/player/play?device_id=${device_id}`;
    console.log("[API /spotify/play] Sending request to Spotify:", {
      url: spotifyApiUrl,
      body: spotifyPlayBody
    });

    const spotifyResponse = await fetch(spotifyApiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${userSpotifyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(spotifyPlayBody),
    });

    if (!spotifyResponse.ok) {
      const errorBody = await spotifyResponse.text();
      console.error(
        "[API /spotify/play] Spotify API error:",
        {
          status: spotifyResponse.status,
          statusText: spotifyResponse.statusText,
          error: errorBody
        }
      );
      try {
        const parsedError = JSON.parse(errorBody);
        return res.status(spotifyResponse.status).json(parsedError);
      } catch (e) {
        return res
          .status(spotifyResponse.status)
          .json({ message: errorBody || "Spotify API returned an error." });
      }
    }

    console.log("[API /spotify/play] Spotify API call successful");
    return res
      .status(spotifyResponse.status)
      .json({ message: "Playback command sent successfully." });
  })
);

// DEV LOGIN ROUTE - Only active in development
if (process.env.NODE_ENV === "development") {
  app.post(
    "/auth/dev-login",
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
      const { userId } = req.body;
      if (!userId) {
        return res
          .status(400)
          .json({ message: "Developer userId (spotify_id) is required." });
      }
      let user = await db("users").where({ spotify_id: userId }).first();
      if (!user) {
        console.log(`Creating new dev user with spotify_id: ${userId}`);
        const [newUserIdFromDb] = await db("users").insert({
          spotify_id: userId,
          display_name: `Dev User (${userId})`,
        });
        user = await db("users").where({ id: newUserIdFromDb }).first();
      }
      if (!user) {
        return res
          .status(500)
          .json({ message: "Failed to create or find dev user." });
      }
      req.login(user, (err) => {
        if (err) {
          console.error("Error during dev req.login:", err);
          return next(err);
        }
        console.log(
          `Developer user ${user.display_name} logged in successfully via dev-login.`,
        );
        return res.status(200).json({ user: req.user });
      });
    })
  );
}

// Centralized error handling middleware
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error("[API] Unhandled Error:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.name === 'UnauthorizedError') {
    res.status(401).json({ message: "Invalid token" });
  } else if (res.headersSent) {
    return next(err);
  } else {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Cool feature: Get top tracks from user's saved playlists
app.get("/top-tracks", async (req, res) => {
  try {
    const response = await fetch(`https://api.spotify.com/v1/me/top/tracks`, {
      headers: { Authorization: `Bearer ${req.headers.authorization}` },
    });
    res.json(await response.json());
  } catch (error: unknown) {
    res.status(500).send((error instanceof Error) ? error.message : "An unknown error occurred");
  }
});

// New endpoint for the current user's playlists
app.get("/api/me/playlists", isAuthenticated, async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      res.status(401).json({ message: "User not authenticated or user ID missing." });
      return;
    }
    const userId = req.user.id;

    console.log(`[API /api/me/playlists] Fetching playlists for user ID: ${userId}`);

    // Assuming your 'playlists' table has a 'user_id' column
    // If playlists are not directly linked to users in your DB, this query needs adjustment
    // or you might fetch based on another criterion (e.g., playlists the user has interacted with).
    const userPlaylists = await db("playlists")
      .where({ user_id: userId }) // Filter by the authenticated user's ID
      .orderBy("created_at", "desc")
      .select("*");

    res.status(200).json(userPlaylists);

  } catch (error) {
    console.error("[API /api/me/playlists GET] Error fetching user playlists:", (error instanceof Error) ? error.message : error);
    next(error);
  }
});

// Start server only if not in test environment or if file is run directly
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`API server listening at http://localhost:${port}`);
  });
}

export default app; // Export the app for testing or for a programmatic start
