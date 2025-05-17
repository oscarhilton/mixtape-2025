import 'express-session';

declare module 'express-session' {
  interface SessionData {
    spotifyAccessToken?: string;
    spotifyRefreshToken?: string;
    spotifyTokenExpiresAt?: number;
    messages?: string[]; // Added for Passport failure messages
    // You can add other custom session properties here if needed
  }
} 