/// <reference types="@types/spotify-web-playback-sdk" />
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext'; // Corrected import to be relative

// Define types for Player state and context
interface SpotifyPlayerState {
  deviceId: string | null;
  isReady: boolean;
  isActive: boolean;
  isPaused: boolean;
  currentTrack: Spotify.Track | null;
  position: number | null;
  duration: number | null; // Added duration for context
  // Add more state properties as needed: shuffle, repeat_mode, volume, duration etc.
}

interface SpotifyPlayerContextType extends SpotifyPlayerState {
  player: Spotify.Player | null;
  play: (options?: { contextUri?: string; uris?: string[]; offset?: { uri?: string, position?: number }, position_ms?: number }) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  // Add more control functions: nextTrack, previousTrack, setVolume etc.
}

const SpotifyPlayerContext = createContext<SpotifyPlayerContextType | undefined>(undefined);

const POSITION_POLL_INTERVAL_MS = 1000; // Poll every 1 second

export const SpotifyPlayerProvider = ({ children }: { children: ReactNode }) => {
  const { user, accessToken } = useAuth();
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [playerState, setPlayerState] = useState<SpotifyPlayerState>({
    deviceId: null,
    isReady: false,
    isActive: false,
    isPaused: true,
    currentTrack: null,
    position: null,
    duration: null, // Initialize duration
  });

  const positionPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('[SpotifyPlayerProvider] Main useEffect triggered. AccessToken:', accessToken);
    if (!accessToken) {
      console.log('[SpotifyPlayerProvider] No access token yet, returning.');
      return;
    }
    if (window.Spotify) {
      initializePlayer(accessToken);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);
    window.onSpotifyWebPlaybackSDKReady = () => initializePlayer(accessToken);

    return () => {
      console.log('[SpotifyPlayerProvider] Cleanup from main useEffect: disconnecting player.');
      player?.disconnect();
      if (positionPollIntervalRef.current) {
        clearInterval(positionPollIntervalRef.current);
      }
    };
  }, [accessToken]); // Removed player from deps, initializePlayer is useCallback without player

  // DEBUG: Check user's Spotify product type
  useEffect(() => {
    if (accessToken) {
      console.log('[SpotifyPlayerProvider] Debug: Checking Spotify product type with current token.');
      fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      .then(response => {
        if (!response.ok) {
          response.text().then(text => {
            console.error('[SpotifyPlayerProvider] Debug: Error fetching /v1/me. Status:', response.status, 'Response:', text);
          });
          throw new Error(`Spotify API /v1/me request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('[SpotifyPlayerProvider] Debug: /v1/me response data:', data);
        if (data && data.product) {
          console.log(`[SpotifyPlayerProvider] Debug: User's Spotify product type: ${data.product}. Display name: ${data.display_name}`);
        } else {
          console.warn('[SpotifyPlayerProvider] Debug: Could not determine Spotify product type from /v1/me response.');
        }
      })
      .catch(error => {
        console.error('[SpotifyPlayerProvider] Debug: Error during /v1/me fetch:', error);
      });
    }
  }, [accessToken]);
  // END DEBUG

  const initializePlayer = useCallback((token: string) => {
    console.log('[SpotifyPlayerProvider] initializePlayer called.');
    if (!window.Spotify || !window.Spotify.Player) return;
    
    const newPlayer = new window.Spotify.Player({
      name: 'Mixtape In A Bottle Web Player',
      getOAuthToken: cb => cb(token),
      volume: 0.5
    });

    newPlayer.addListener('ready', ({ device_id }) => {
      console.log('[SpotifyPlayerProvider] Player Ready with Device ID', device_id);
      setPlayerState(ps => ({ ...ps, deviceId: device_id, isReady: true }));
    });

    newPlayer.addListener('not_ready', ({ device_id }) => {
      console.log('[SpotifyPlayerProvider] Player Not Ready. Device ID:', device_id);
      setPlayerState(ps => ({ ...ps, deviceId: device_id, isReady: false, isActive: false }));
    });

    newPlayer.addListener('player_state_changed', (state: Spotify.PlaybackState | null) => {
      console.log('[SpotifyPlayerContext] player_state_changed event. SDK state.position:', state?.position);
      if (!state) {
        setPlayerState(ps => ({ ...ps, isActive: false, isPaused: true, currentTrack: null, position: null, duration: null }));
        return;
      }
      setPlayerState(ps => ({
        ...ps,
        isActive: true,
        isPaused: state.paused,
        currentTrack: state.track_window.current_track,
        position: state.position,
        duration: state.duration,
      }));
    });
    
    // Add other listeners (error handling etc.) from your previous setup
    newPlayer.addListener('initialization_error', ({ message }) => console.error('Failed to initialize:', message));
    newPlayer.addListener('authentication_error', ({ message }) => console.error('Failed to authenticate:', message));
    newPlayer.addListener('account_error', ({ message }) => console.error('Account error:', message));
    newPlayer.addListener('playback_error', ({ message }) => console.error('Playback error:', message));

    newPlayer.connect().then(success => {
      if (success) console.log('[SpotifyPlayerProvider] Player connected successfully!');
      else console.log('[SpotifyPlayerProvider] Player failed to connect.');
    });
    setPlayer(newPlayer);
  }, []); // Empty dependency array as token is passed directly

  // Effect for polling position
  useEffect(() => {
    const pollPosition = async () => {
      if (player && playerState.isReady && !playerState.isPaused && playerState.isActive) {
        try {
          const currentState = await player.getCurrentState();
          if (currentState) {
            // console.log('[SpotifyPlayerProvider] Polled position:', currentState.position);
            setPlayerState(ps => ({
              ...ps,
              position: currentState.position,
              duration: currentState.duration, // Also update duration
              // Keep currentTrack and other major states from player_state_changed if possible,
              // as getCurrentState() might not always reflect instantaneous track changes as quickly.
              // However, for position, this is more reliable if player_state_changed is infrequent.
              currentTrack: currentState.track_window.current_track, // It's good to keep track info updated too
              isPaused: currentState.paused, // Keep pause state consistent
            }));
          }
        } catch (error) {
          console.error('[SpotifyPlayerProvider] Error polling player state:', error);
          // Potentially stop polling if errors persist or player becomes not_ready
        }
      }
    };

    if (playerState.isReady && !playerState.isPaused && playerState.isActive) {
      if (positionPollIntervalRef.current) clearInterval(positionPollIntervalRef.current); // Clear existing before setting new
      positionPollIntervalRef.current = setInterval(pollPosition, POSITION_POLL_INTERVAL_MS);
      console.log('[SpotifyPlayerProvider] Started position polling.');
    } else {
      if (positionPollIntervalRef.current) {
        clearInterval(positionPollIntervalRef.current);
        positionPollIntervalRef.current = null;
        console.log('[SpotifyPlayerProvider] Stopped position polling.');
      }
    }

    return () => {
      if (positionPollIntervalRef.current) {
        clearInterval(positionPollIntervalRef.current);
        console.log('[SpotifyPlayerProvider] Cleaned up position polling interval from polling effect.');
      }
    };
  }, [player, playerState.isReady, playerState.isPaused, playerState.isActive]); // Dependencies for managing the polling interval

  // Playback control functions
  const play = async (options?: { contextUri?: string; uris?: string[]; offset?: { uri?: string, position?: number }, position_ms?: number }) => {
    console.log('[SpotifyPlayerProvider] play called. Device ID from playerState:', playerState.deviceId, 'Options:', options, 'Player instance available:', !!player, 'Access Token available:', !!accessToken);
    if (!player || !playerState.deviceId || !accessToken) {
      console.error('Cannot play: Player not ready, no device ID, or no access token.', { playerReady: !!player, deviceId: playerState.deviceId, hasToken: !!accessToken });
      return;
    }
    console.log(`[SpotifyPlayerProvider] Attempting to play:`, options, 'on device:', playerState.deviceId);

    try {
      // We need to pass the user's Spotify access token for this API call
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/spotify/play`, { 
        method: 'PUT', // Spotify API uses PUT for this endpoint
        headers: {
          'Content-Type': 'application/json',
          // The backend will use the user's session-stored access token.
          // If direct frontend-to-spotify call was made, Authorization header would be needed here.
        },
        credentials: 'include', // Send cookies for session-based auth to our backend
        body: JSON.stringify({
          device_id: playerState.deviceId,
          ...(options?.contextUri && { context_uri: options.contextUri }),
          ...(options?.uris && { uris: options.uris }),
          ...(options?.offset && { offset: options.offset }),
          ...(options?.position_ms && { position_ms: options.position_ms }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        console.error('Failed to start playback via backend:', response.status, errorData);
        throw new Error(`Playback API call failed: ${errorData.message || response.statusText}`);
      }
      console.log('[SpotifyPlayerProvider] Play command sent to backend successfully.');
      // Playback should start on the selected device. Player state will update via 'player_state_changed' event.
    } catch (error) {
      console.error('Error in play function:', error);
    }
  };

  const pause = async () => {
    if (player) await player.pause();
  };

  const resume = async () => {
    if (player) await player.resume();
  };

  const seek = async (positionMs: number) => {
    if (player) await player.seek(positionMs);
  };

  return (
    <SpotifyPlayerContext.Provider value={{ ...playerState, player, play, pause, resume, seek }}>
      {children}
    </SpotifyPlayerContext.Provider>
  );
};

export const useSpotifyPlayer = () => {
  const context = useContext(SpotifyPlayerContext);
  if (context === undefined) {
    throw new Error('useSpotifyPlayer must be used within a SpotifyPlayerProvider');
  }
  return context;
}; 