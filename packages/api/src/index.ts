import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import knexConstructor from 'knex';
import session from 'express-session';
import passport from 'passport';
import { Strategy as SpotifyStrategy, Profile as SpotifyProfile } from 'passport-spotify';
// @ts-ignore
import knexfile from '../knexfile'; // Using knexfile.js which is CommonJS
import fetch from 'node-fetch'; // Added for Spotify API calls
import { URLSearchParams } from 'url'; // Added for token request

dotenv.config();

const app = express();
const port = process.env.API_PORT || 3001;
const db = knexConstructor(knexfile.development);

// Spotify Access Token Cache (Client Credentials Flow)
let spotifyAccessToken: string | null = null;
let spotifyTokenExpiresAt: number | null = null;

async function getSpotifyAccessToken(): Promise<string | null> {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error('Spotify Client ID or Secret not configured for server-to-server auth.');
    return null;
  }
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
      },
      body: params
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Failed to fetch Spotify access token:', response.status, errorBody);
      throw new Error(`Spotify token API error: ${response.status}`);
    }

    const data = await response.json() as { access_token: string, expires_in: number };
    spotifyAccessToken = data.access_token;
    // Set expiry time with a small buffer (e.g., 60 seconds) before actual expiry
    spotifyTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    console.log('Successfully fetched new Spotify server access token.');
    return spotifyAccessToken;
  } catch (error) {
    console.error('Error fetching Spotify access token:', error);
    spotifyAccessToken = null;
    spotifyTokenExpiresAt = null;
    return null;
  }
}

async function getValidSpotifyToken(): Promise<string | null> {
  if (spotifyAccessToken && spotifyTokenExpiresAt && Date.now() < spotifyTokenExpiresAt) {
    return spotifyAccessToken;
  }
  // Token is invalid or expired, fetch a new one
  return getSpotifyAccessToken();
}

// Helper function to refresh user's Spotify access token if needed
async function getRefreshedUserSpotifyToken(req: Request): Promise<string | null> {
  if (!req.session || !req.session.spotifyRefreshToken) {
    console.error('[TokenRefresh] No refresh token in session.');
    return null;
  }

  // Check if token is expired or close to expiry (e.g., within 5 minutes)
  const fiveMinutesInMs = 5 * 60 * 1000;
  if (req.session.spotifyTokenExpiresAt && (req.session.spotifyTokenExpiresAt - Date.now()) > fiveMinutesInMs && req.session.spotifyAccessToken) {
    console.log('[TokenRefresh] Current access token is still valid.');
    return req.session.spotifyAccessToken;
  }

  console.log('[TokenRefresh] Access token expired or nearing expiry. Attempting refresh.');
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error('[TokenRefresh] Spotify client ID or secret not configured for token refresh.');
    return null; // Cannot refresh without client credentials
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', req.session.spotifyRefreshToken);

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      },
      body: params,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[TokenRefresh] Failed to refresh Spotify access token:', response.status, errorBody);
      // If refresh fails (e.g. bad refresh token), we might need to clear session tokens / re-authenticate user
      // For now, just return null, the caller should handle this (e.g. by sending 401)
      return null;
    }

    const data = await response.json() as { access_token: string, expires_in: number, refresh_token?: string };
    
    req.session.spotifyAccessToken = data.access_token;
    req.session.spotifyTokenExpiresAt = Date.now() + (data.expires_in * 1000);
    // Spotify might return a new refresh token, update if it does
    if (data.refresh_token) {
      req.session.spotifyRefreshToken = data.refresh_token;
    }
    
    // Explicitly save the session after updating tokens
    await new Promise<void>((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          console.error('[TokenRefresh] Error saving session after token refresh:', err);
          return reject(err);
        }
        console.log('[TokenRefresh] Successfully refreshed token and saved to session.');
        resolve();
      });
    });

    return req.session.spotifyAccessToken;
  } catch (error) {
    console.error('[TokenRefresh] Error during token refresh process:', error);
    return null;
  }
}

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_for_development', // Fallback for safety
    resave: false,
    saveUninitialized: false, // Don't create session until something stored
    cookie: {
      secure: process.env.NODE_ENV === 'production', // true in production if using HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax' // Explicitly set SameSite to Lax for development
    },
  })
);

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user: any, done) => {
  done(null, user.id); // Store user ID in session
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await db('users').where({ id }).first();
    done(null, user);
  } catch (err: any) {
    done(err, null);
  }
});

if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.error("ERROR: Spotify Client ID or Secret not configured in .env file!");
  // process.exit(1); // Optionally exit if not configured
} else {
  passport.use(
    new SpotifyStrategy(
      {
        clientID: process.env.SPOTIFY_CLIENT_ID!,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
        callbackURL: `http://localhost:${port}/auth/spotify/callback`,
        scope: ['user-read-email', 'user-read-private', 'playlist-read-private', 'streaming', 'user-modify-playback-state', 'user-read-playback-state'],
        passReqToCallback: true // Pass req object to the callback
      },
      async (req: Request, accessToken: string, refreshToken: string, expires_in: number, profile: SpotifyProfile, done: (error: any, user?: any) => void) => {
        console.log('[SpotifyStrategy] Callback invoked. AccessToken received (first 20 chars):', accessToken.substring(0, 20));
        console.log('[SpotifyStrategy] Profile object received:', JSON.stringify(profile, null, 2)); // Log the full profile object

        try {
          req.spotifyAuthDetails = {
            accessToken,
            refreshToken,
            tokenExpiresAt: Date.now() + (expires_in * 1000)
          };
          console.log('[SpotifyStrategy] Auth details attached to req:', req.spotifyAuthDetails);

          if (!profile || !profile.id) {
            console.error('[SpotifyStrategy] Critical: Profile or profile.id is missing!', profile);
            return done(new Error('Spotify profile ID is missing'));
          }

          console.log(`[SpotifyStrategy] Looking for user with spotify_id: ${profile.id}`);
          let user = await db('users').where({ spotify_id: profile.id }).first();
          console.log('[SpotifyStrategy] Result of db.where for existing user:', user);
          
          if (user) {
            console.log('[SpotifyStrategy] Existing user found:', user.id);
            return done(null, user);
          } else {
            console.log('[SpotifyStrategy] New user. Profile ID:', profile.id, 'Display Name:', profile.displayName);
            console.log('[SpotifyStrategy] Attempting to insert new user...');
            const newUserRecord = {
              spotify_id: profile.id,
              display_name: profile.displayName || profile.username || 'Spotify User', // Fallback for display name
              email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null, // Safely access email
            };
            console.log('[SpotifyStrategy] New user data to insert:', newUserRecord);

            const [newUserId] = await db('users').insert(newUserRecord);
            console.log('[SpotifyStrategy] Insert result (newUserId):', newUserId);

            user = await db('users').where({ id: newUserId }).first();
            console.log('[SpotifyStrategy] New user created and fetched:', user);
            
            if (!user) {
                console.error('[SpotifyStrategy] Critical: Failed to fetch newly created user!');
                return done(new Error('Failed to retrieve user after creation.'));
            }
            return done(null, user);
          }
        } catch (err: any) { 
          console.error('[SpotifyStrategy] Error during database operation or profile processing:', err);
          return done(err);
        }
      }
    )
  );
}

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3002'], // Allow both typical frontend ports
    credentials: true // Allow cookies to be sent
}));
app.use(express.json());

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'User not authenticated.' });
};

// Auth Routes
app.get('/auth/spotify', passport.authenticate('spotify'));

app.get('/auth/spotify/callback', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('spotify', 
  // No options here, or only options applicable to all authenticate calls, not strategy-specific ones
  (err: any, user: Express.User | false | null, info: any, status: number | undefined) => {
    console.log('[SpotifyCallback-Custom] passport.authenticate callback reached.');
    if (err) {
      console.error('[SpotifyCallback-Custom] Authentication error (err):', err);
      // Potentially use info for more details if err is generic
      const message = info?.message || err.message || 'Spotify authentication failed.';
      if (req.session) {
        req.session.messages = req.session.messages || [];
        req.session.messages.push(typeof message === 'string' ? message : JSON.stringify(message));
        req.session.save(); // Ensure messages are saved before redirect
      }
      return res.redirect('/auth/login-failed'); 
    }
    if (!user) {
      console.error('[SpotifyCallback-Custom] Authentication failed: No user returned. Info:', info, 'Status:', status);
      const message = info?.message || 'Authentication failed: No user.';
      if (req.session) {
        req.session.messages = req.session.messages || [];
        req.session.messages.push(typeof message === 'string' ? message : JSON.stringify(message));
        req.session.save();
      }
      return res.redirect('/auth/login-failed');
    }

    // If we get here, authentication was successful, proceed to log in the user
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('[SpotifyCallback-Custom] req.logIn error:', loginErr);
        if (req.session) {
          req.session.messages = req.session.messages || [];
          req.session.messages.push(loginErr.message || 'Login after authentication failed.');
          req.session.save();
        }
        return res.redirect('/auth/login-failed');
      }

      // Successful login, now handle session details for Spotify tokens
      if (req.spotifyAuthDetails && req.session) {
        console.log('[SpotifyCallback-Custom] User authenticated by custom callback:', user);
        console.log('[SpotifyCallback-Custom] Spotify auth details found on req:', req.spotifyAuthDetails);
        req.session.spotifyAccessToken = req.spotifyAuthDetails.accessToken;
        req.session.spotifyRefreshToken = req.spotifyAuthDetails.refreshToken;
        req.session.spotifyTokenExpiresAt = req.spotifyAuthDetails.tokenExpiresAt;
        console.log('[SpotifyCallback-Custom] Spotify tokens stored in session.');
        req.session.save(saveErr => {
          if (saveErr) {
            console.error('[SpotifyCallback-Custom] Error saving session with tokens:', saveErr);
            // Fall through to redirect, but log the error
          }
          return res.redirect('http://localhost:3000/');
        });
      } else {
        console.error('[SpotifyCallback-Custom] Auth success but spotifyAuthDetails or session missing on req after login.');
        if (req.session) {
            req.session.messages = req.session.messages || [];
            req.session.messages.push('Internal setup error after login.');
            req.session.save();
        }
        return res.redirect('/auth/login-failed');
      }
    });
  })(req, res, next); // Important to call the handler this way for custom callbacks
});

// Existing route to handle login failures
app.get('/auth/login-failed', (req: Request, res: Response) => {
  const messages = req.session?.messages || [];
  console.error('[LoginFailed] Authentication failed. Messages:', messages);
  // Clear any messages if you only want to show them once
  if (req.session) req.session.messages = []; 
  res.status(401).json({ 
    message: 'Spotify authentication failed.', 
    details: messages 
  });
});

app.get('/auth/logout', (req, res, next) => {
    req.logout((err: any) => {
        if (err) { return next(err); }
        req.session.destroy((destroyErr: any) => {
            if (destroyErr) {
                return next(destroyErr);
            }
            res.clearCookie('connect.sid'); // Clears the session cookie
            res.status(200).json({ message: 'Logged out successfully' });
        });
    });
});

// Endpoint to check current user session
app.get('/auth/me', (req: Request, res: Response) => {
  console.log('[AuthMe] Session content:', req.session);
  if (req.isAuthenticated() && req.user && req.session) {
    const userObject = req.user as any; 
    res.json({ 
        user: { 
            id: userObject.id, 
            spotify_id: userObject.spotify_id, 
            display_name: userObject.display_name, 
            email: userObject.email 
        }, 
        accessToken: req.session.spotifyAccessToken || null // Retrieve from session
    });
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

// Spotify API Proxy Routes (using server-side token)
app.get('/spotify/playlist-name/:playlistId', async (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    const { playlistId } = req.params;
    const token = await getValidSpotifyToken();
    if (!token) {
      return res.status(503).json({ message: 'Could not retrieve Spotify API token.' });
    }
    try {
      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Spotify API error for playlist name ${playlistId}: ${response.status}`, errorBody);
        return res.status(response.status).json({ message: 'Failed to fetch playlist name from Spotify.', details: errorBody });
      }
      const data = await response.json() as { name: string };
      res.json({ name: data.name });
    } catch (error) {
      console.error(`Error fetching playlist name for ${playlistId}:`, error);
      next(error); // Pass to generic error handler
    }
  })().catch(next);
});

app.get('/spotify/playlist/:playlistId/tracks', async (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    const { playlistId } = req.params;
    const token = await getValidSpotifyToken(); // Use server-side token
    if (!token) {
      return res.status(503).json({ message: 'Could not retrieve Spotify API token for server.' });
    }
    try {
      // You can adjust 'fields' to get more or less data about tracks
      // e.g., fields=items(track(name,artists,album(name,images),uri,id,duration_ms))
      const fields = 'items(track(id,name,artists(name),album(name,images),uri,duration_ms))';
      const limit = 50; // Spotify API limit per request
      let offset = 0;
      let allTracks: any[] = [];
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=${fields}&limit=${limit}&offset=${offset}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`Spotify API error for playlist tracks ${playlistId}: ${response.status}`, errorBody);
          // Check for specific 404 for playlist not found
          if (response.status === 404) {
            return res.status(404).json({ message: `Playlist with ID ${playlistId} not found on Spotify.`, details: errorBody });
          }
          return res.status(response.status).json({ message: 'Failed to fetch playlist tracks from Spotify.', details: errorBody });
        }
        
        const pageData = await response.json() as { items: any[], next: string | null, total: number };
        if (pageData.items) {
          allTracks = allTracks.concat(pageData.items.map(item => item.track).filter(track => track)); // Ensure track is not null
        }
        
        if (pageData.next) {
          offset += limit;
        } else {
          hasMore = false;
        }
        // Safety break if a playlist somehow claims to have more items than a reasonable limit,
        // or if there are no items and next is still present (unlikely).
        if (offset > (pageData.total || 500) + limit) { // pageData.total might not always be accurate or present for all field selections
             console.warn(`[Spotify Tracks] Exceeded expected offset for playlist ${playlistId}. Total items: ${pageData.total}, current offset: ${offset}. Breaking loop.`);
             hasMore = false;
        }
        if (!pageData.items || pageData.items.length === 0 && pageData.next) {
            console.warn(`[Spotify Tracks] No items returned but 'next' URL present for playlist ${playlistId}. Offset: ${offset}. Breaking loop.`);
            hasMore = false;
        }

      }
      // The structure expected by the frontend's Track interface is directly { id, name, artists, album, uri, duration_ms }
      // The Spotify API nests this under `track` within each item.
      // The mapping `item => item.track` above handles this.
      res.json(allTracks); 
    } catch (error) {
      console.error(`Error fetching playlist tracks for ${playlistId}:`, error);
      next(error);
    }
  })().catch(next);
});

// Playlist Routes
app.get('/', (req: Request, res: Response) => {
  res.send('Hello from the API!');
});

// Middleware for async error handling
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Get all playlists
app.get('/playlists', asyncHandler(async (req: Request, res: Response) => {
  const playlists = await db('playlists').select('*');
  res.json(playlists);
}));

// Create a new playlist
app.post('/playlists', asyncHandler(async (req: Request, res: Response) => {
  const { name, spotify_playlist_id, description, latitude, longitude } = req.body;
  if (!name || !spotify_playlist_id) {
    return res.status(400).json({ message: "Missing required fields: name and spotify_playlist_id" });
  }
  if (!latitude || !longitude) {
    return res.status(400).json({ message: "Missing required fields: latitude and longitude" });
  }
  try {
    const [newPlaylistId] = await db('playlists').insert({ 
      name, 
      spotify_playlist_id, 
      description,
      latitude,
      longitude
    });
    const newPlaylist = await db('playlists').where({ id: newPlaylistId }).first();
    res.status(201).json(newPlaylist);
  } catch (error: unknown) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ message: "Failed to create playlist" });
  }
}));

// Get a single playlist by ID
app.get('/playlists/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const playlist = await db('playlists').where({ id }).first();
  if (playlist) {
    res.json(playlist);
  } else {
    res.status(404).json({ message: "Playlist not found" });
  }
}));

// Update a playlist (e.g., description)
app.put('/playlists/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const updatedCount = await db('playlists').where({ id }).update({ name, description, updated_at: db.fn.now() });
  if (updatedCount > 0) {
    const updatedPlaylist = await db('playlists').where({ id }).first();
    res.json(updatedPlaylist);
  } else {
    res.status(404).json({ message: "Playlist not found" });
  }
}));

// Increment vote for a playlist
app.post('/playlists/:id/vote', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const playlist = await db('playlists').where({ id }).first();
  if (!playlist) {
    return res.status(404).json({ message: "Playlist not found" });
  }
  await db('playlists').where({ id }).increment('votes', 1);
  const updatedPlaylist = await db('playlists').where({ id }).first();
  res.json(updatedPlaylist);
}));

// Delete a playlist
app.delete('/playlists/:id', asyncHandler(async (req: Request, res: Response) => {
  // Add authentication check: if (!req.isAuthenticated()) { return res.status(401).send('Unauthorized'); }
  const { id } = req.params;
  const deletedCount = await db('playlists').where({ id }).del();
  if (deletedCount > 0) {
    res.status(200).json({ message: "Playlist deleted successfully" });
  } else {
    res.status(404).json({ message: "Playlist not found" });
  }
}));

// Comment Routes
// Create a new comment on a track in a playlist
app.post('/comments', asyncHandler(async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: 'User not authenticated.' });
  }
  const { playlist_id, track_uri, timestamp_ms, comment_text } = req.body;
  const user_id = (req.user as any).id;

  if (!playlist_id || !track_uri || timestamp_ms === undefined || !comment_text) {
    return res.status(400).json({ message: "Missing required fields: playlist_id, track_uri, timestamp_ms, comment_text." });
  }

  // Optional: Validate that the playlist exists
  const playlist = await db('playlists').where({ id: playlist_id }).first();
  if (!playlist) {
    return res.status(404).json({ message: "Playlist not found." });
  }

  const newComment = {
    playlist_id,
    user_id,
    track_uri,
    timestamp_ms,
    comment_text
  };

  const [newCommentId] = await db('playlist_track_comments').insert(newComment);
  const createdComment = await db('playlist_track_comments').where({ id: newCommentId }).first();
  
  res.status(201).json(createdComment);
}));

// Get all comments for a specific playlist
app.get('/playlists/:playlistId/comments', asyncHandler(async (req: Request, res: Response) => {
  const { playlistId } = req.params;

  // Optional: Validate that the playlist exists
  const playlist = await db('playlists').where({ id: playlistId }).first();
  if (!playlist) {
    return res.status(404).json({ message: "Playlist not found." });
  }

  const comments = await db('playlist_track_comments')
    .where({ playlist_id: playlistId })
    .orderBy('created_at', 'asc'); // Or order by track_uri, then timestamp_ms
  
  res.json(comments);
}));

// Spotify Playback Proxy (using USER's session token)
app.put('/spotify/play', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    console.log('[API /spotify/play] Received request body:', JSON.stringify(req.body, null, 2));
    if (!req.isAuthenticated() || !req.user) { // Session presence checked by getRefreshedUserSpotifyToken
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    const userSpotifyToken = await getRefreshedUserSpotifyToken(req);

    if (!userSpotifyToken) {
      // If token refresh failed or no initial token, user might need to re-authenticate fully.
      return res.status(401).json({ message: 'Spotify access token missing or failed to refresh. Please re-login.' });
    }

    const { device_id, context_uri, uris, offset, position_ms } = req.body;
    console.log(`[API /spotify/play] Extracted userSpotifyToken (first 20 chars): ${userSpotifyToken?.substring(0, 20)}...`); 

    if (!device_id) {
      return res.status(400).json({ message: 'Device ID is required.' });
    }

    // Ensure that either context_uri or uris is provided, but not if both are empty (which is already handled by Spotify)
    // The main issue is sending both if both are present.

    const spotifyPlayBody: any = {};
    if (offset) spotifyPlayBody.offset = offset;
    if (typeof position_ms === 'number') spotifyPlayBody.position_ms = position_ms;

    if (context_uri) { // Prioritize context_uri if provided
      spotifyPlayBody.context_uri = context_uri;
    } else if (uris && uris.length > 0) {
      spotifyPlayBody.uris = uris;
    } else {
      // This case should ideally be caught by the frontend or earlier validation,
      // but as a fallback, Spotify will also return an error.
      return res.status(400).json({ message: 'Either context_uri or uris must be provided to start playback.' });
    }

    const spotifyApiUrl = `https://api.spotify.com/v1/me/player/play?device_id=${device_id}`;
    console.log(`[API /spotify/play] Sending request to Spotify: ${spotifyApiUrl} with body:`, JSON.stringify(spotifyPlayBody));

    const spotifyResponse = await fetch(spotifyApiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${userSpotifyToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(spotifyPlayBody),
    });

    if (!spotifyResponse.ok) {
      const errorBody = await spotifyResponse.text();
      console.error('[API /spotify/play] Spotify API error:', spotifyResponse.status, errorBody);
      try {
        const parsedError = JSON.parse(errorBody);
        return res.status(spotifyResponse.status).json(parsedError);
      } catch (e) {
        return res.status(spotifyResponse.status).json({ message: errorBody || 'Spotify API returned an error.' });
      }
    }
    
    console.log('[API /spotify/play] Spotify API call successful, status:', spotifyResponse.status);
    return res.status(spotifyResponse.status).json({ message: 'Playback command sent successfully.' });

  })().catch(err => {
    console.error('[API /spotify/play] Unhandled error in async block:', err);
    next(err); 
  });
});

// DEV LOGIN ROUTE - Only active in development
if (process.env.NODE_ENV === 'development') {
  app.post('/auth/dev-login', (req: Request, res: Response, next: NextFunction) => {
    (async () => {
      const { userId } = req.body; 
      if (!userId) {
        return res.status(400).json({ message: 'Developer userId (spotify_id) is required.' });
      }
      let user = await db('users').where({ spotify_id: userId }).first();
      if (!user) {
        console.log(`Creating new dev user with spotify_id: ${userId}`);
        const [newUserIdFromDb] = await db('users').insert({
          spotify_id: userId,
          display_name: `Dev User (${userId})`,
        });
        user = await db('users').where({ id: newUserIdFromDb }).first();
      }
      if (!user) {
        return res.status(500).json({ message: 'Failed to create or find dev user.' });
      }
      req.login(user, (err) => {
        if (err) {
          console.error('Error during dev req.login:', err);
          return next(err); 
        }
        console.log(`Developer user ${user.display_name} logged in successfully via dev-login.`);
        return res.status(200).json({ user: req.user });
      });
    })().catch(err => {
      console.error('Unhandled error in /auth/dev-login async block:', err);
      next(err); 
    });
  });
}

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  if (err.message.includes("Failed to fetch playlists")) { // Example of specific error handling
    res.status(503).json({ message: "Service temporarily unavailable: Could not fetch playlists.", error: err.message });
  } else {
    res.status(500).json({ message: "Something went wrong!", error: err.message });
  }
});

// Cool feature: Get top tracks from user's saved playlists
app.get('/top-tracks', async (req, res) => {
  try {
    const response = await fetch(`https://api.spotify.com/v1/me/top/tracks`, {
      headers: { Authorization: `Bearer ${req.headers.authorization}` },
    });
    res.json(await response.json());
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Start server only if not in test environment or if file is run directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`API server listening at http://localhost:${port}`);
  });
}

export default app; // Export the app for testing or for a programmatic start 