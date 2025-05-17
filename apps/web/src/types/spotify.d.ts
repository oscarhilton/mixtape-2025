// apps/web/src/types/spotify.d.ts

// This extends the global Window object to include Spotify Web Playback SDK properties
declare global {
  interface Window {
    Spotify: typeof Spotify; // Spotify namespace itself
    onSpotifyWebPlaybackSDKReady: (() => void) | undefined;
  }
}

// Re-export Spotify namespace to be usable in other files if needed directly,
// though usually referencing window.Spotify is enough after this global declaration.
// Or it can be imported from '@types/spotify-web-playback-sdk' if that module makes it available directly.
// For now, this ensures Window.Spotify is recognized.
export {}; // This makes the file a module, which is required for 'declare global'. 