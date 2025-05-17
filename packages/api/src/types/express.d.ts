import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    spotifyAuthDetails?: {
      accessToken: string;
      refreshToken: string;
      tokenExpiresAt: number;
    };
  }
}
