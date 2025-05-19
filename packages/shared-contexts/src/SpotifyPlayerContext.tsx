/// <reference types="@types/spotify-web-playback-sdk" />
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext"; // Corrected import to be relative

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
  play: (options?: {
    contextUri?: string;
    uris?: string[];
    offset?: { uri?: string; position?: number };
    position_ms?: number;
  }) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  // Add more control functions: nextTrack, previousTrack, setVolume etc.
}

const SpotifyPlayerContext = createContext<
  SpotifyPlayerContextType | undefined
>(undefined);

const POSITION_POLL_INTERVAL_MS = 1000; // Poll every 1 second

export const SpotifyPlayerProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
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
    console.log(
      "[SpotifyPlayerProvider] Main useEffect triggered. AccessToken:",
      accessToken ? "Present" : "Missing",
      "Window.Spotify:",
      window.Spotify ? "Loaded" : "Not loaded",
    );
    if (!accessToken) {
      console.log("[SpotifyPlayerProvider] No access token yet, returning.");
      return;
    }
    if (window.Spotify) {
      console.log("[SpotifyPlayerProvider] Spotify SDK already loaded, initializing player.");
      initializePlayer(accessToken);
      return;
    }
    console.log("[SpotifyPlayerProvider] Loading Spotify SDK script...");
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    
    // Add load and error event listeners
    script.onload = () => {
      console.log("[SpotifyPlayerProvider] Spotify SDK script loaded successfully");
    };
    
    script.onerror = (error) => {
      console.error("[SpotifyPlayerProvider] Failed to load Spotify SDK script:", error);
    };
    
    document.body.appendChild(script);
    console.log("[SpotifyPlayerProvider] Spotify SDK script element added to document");
    
    window.onSpotifyWebPlaybackSDKReady = () => {
      console.log("[SpotifyPlayerProvider] Spotify SDK ready callback triggered.");
      initializePlayer(accessToken);
    };

    return () => {
      console.log(
        "[SpotifyPlayerProvider] Cleanup from main useEffect: disconnecting player.",
      );
      player?.disconnect();
      if (positionPollIntervalRef.current) {
        clearInterval(positionPollIntervalRef.current);
      }
    };
  }, [accessToken]);

  // DEBUG: Check user's Spotify product type
  useEffect(() => {
    if (accessToken) {
      console.log(
        "[SpotifyPlayerProvider] Debug: Checking Spotify product type with current token.",
      );
      fetch("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then((response) => {
          if (!response.ok) {
            response.text().then((text) => {
              console.error(
                "[SpotifyPlayerProvider] Debug: Error fetching /v1/me. Status:",
                response.status,
                "Response:",
                text,
              );
            });
            throw new Error(
              `Spotify API /v1/me request failed with status ${response.status}`,
            );
          }
          return response.json();
        })
        .then((data) => {
          console.log(
            "[SpotifyPlayerProvider] Debug: /v1/me response data:",
            data,
          );
          if (data && data.product) {
            console.log(
              `[SpotifyPlayerProvider] Debug: User's Spotify product type: ${data.product}. Display name: ${data.display_name}`,
            );
          } else {
            console.warn(
              "[SpotifyPlayerProvider] Debug: Could not determine Spotify product type from /v1/me response.",
            );
          }
        })
        .catch((error) => {
          console.error(
            "[SpotifyPlayerProvider] Debug: Error during /v1/me fetch:",
            error,
          );
        });
    }
  }, [accessToken]);
  // END DEBUG

  const initializePlayer = useCallback((token: string) => {
    console.log("[SpotifyPlayerProvider] initializePlayer called with token:", token ? "Present" : "Missing");
    if (!window.Spotify || !window.Spotify.Player) {
      console.error("[SpotifyPlayerProvider] Spotify SDK not available for initialization");
      return;
    }

    console.log("[SpotifyPlayerProvider] Creating new Spotify player instance...");
    const newPlayer = new window.Spotify.Player({
      name: "Mixtape In A Bottle Web Player",
      getOAuthToken: (cb) => {
        console.log("[SpotifyPlayerProvider] getOAuthToken callback triggered");
        cb(token);
      },
      volume: 0.5,
    });

    newPlayer.addListener("ready", ({ device_id }) => {
      console.log(
        "[SpotifyPlayerProvider] Player Ready with Device ID:",
        device_id,
        "Setting player state to ready"
      );
      setPlayerState((ps) => ({ ...ps, deviceId: device_id, isReady: true }));
    });

    newPlayer.addListener("not_ready", ({ device_id }) => {
      console.log(
        "[SpotifyPlayerProvider] Player Not Ready. Device ID:",
        device_id,
        "Setting player state to not ready"
      );
      setPlayerState((ps) => ({
        ...ps,
        deviceId: device_id,
        isReady: false,
        isActive: false,
      }));
    });

    newPlayer.addListener("initialization_error", ({ message }) => {
      console.error("[SpotifyPlayerProvider] Failed to initialize:", message);
    });

    newPlayer.addListener("authentication_error", ({ message }) => {
      console.error("[SpotifyPlayerProvider] Failed to authenticate:", message);
    });

    newPlayer.addListener("account_error", ({ message }) => {
      console.error("[SpotifyPlayerProvider] Account error:", message);
    });

    newPlayer.addListener("playback_error", ({ message }) => {
      console.error("[SpotifyPlayerProvider] Playback error:", message);
    });

    console.log("[SpotifyPlayerProvider] Attempting to connect player...");
    newPlayer.connect().then((success) => {
      if (success) {
        console.log("[SpotifyPlayerProvider] Player connected successfully!");
        setPlayer(newPlayer);
      } else {
        console.error("[SpotifyPlayerProvider] Player failed to connect!");
      }
    });
  }, []);

  // Effect for polling position
  useEffect(() => {
    const pollPosition = async () => {
      if (
        player &&
        playerState.isReady &&
        !playerState.isPaused &&
        playerState.isActive
      ) {
        try {
          const currentState = await player.getCurrentState();
          if (currentState) {
            // console.log('[SpotifyPlayerProvider] Polled position:', currentState.position);
            setPlayerState((ps) => ({
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
          console.error(
            "[SpotifyPlayerProvider] Error polling player state:",
            error,
          );
          // Potentially stop polling if errors persist or player becomes not_ready
        }
      }
    };

    if (playerState.isReady && !playerState.isPaused && playerState.isActive) {
      if (positionPollIntervalRef.current)
        clearInterval(positionPollIntervalRef.current); // Clear existing before setting new
      positionPollIntervalRef.current = setInterval(
        pollPosition,
        POSITION_POLL_INTERVAL_MS,
      );
      console.log("[SpotifyPlayerProvider] Started position polling.");
    } else {
      if (positionPollIntervalRef.current) {
        clearInterval(positionPollIntervalRef.current);
        positionPollIntervalRef.current = null;
        console.log("[SpotifyPlayerProvider] Stopped position polling.");
      }
    }

    return () => {
      if (positionPollIntervalRef.current) {
        clearInterval(positionPollIntervalRef.current);
        console.log(
          "[SpotifyPlayerProvider] Cleaned up position polling interval from polling effect.",
        );
      }
    };
  }, [player, playerState.isReady, playerState.isPaused, playerState.isActive]); // Dependencies for managing the polling interval

  // Playback control functions
  const play = async (options?: {
    contextUri?: string;
    uris?: string[];
    offset?: { uri?: string; position?: number };
    position_ms?: number;
  }) => {
    console.log(
      "[SpotifyPlayerProvider] play called with options:",
      JSON.stringify(options, null, 2),
      "\nDevice ID:", playerState.deviceId,
      "\nPlayer instance:", !!player,
      "\nAccess Token:", !!accessToken,
    );
    if (!player || !playerState.deviceId || !accessToken) {
      console.error(
        "[SpotifyPlayerProvider] Cannot play: Missing required components",
        {
          playerReady: !!player,
          deviceId: playerState.deviceId,
          hasToken: !!accessToken,
        },
      );
      return;
    }

    try {
      const response = await fetch("/api/spotify/play", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_id: playerState.deviceId,
          ...options,
        }),
      });

      console.log("[SpotifyPlayerProvider] Play request response:", {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to parse error response" }));
        console.error("[SpotifyPlayerProvider] Play request failed:", errorData);
        throw new Error(errorData.message || "Failed to start playback");
      }

      const data = await response.json().catch(() => ({ message: "Failed to parse response" }));
      console.log("[SpotifyPlayerProvider] Play request successful:", data);
    } catch (error) {
      console.error("[SpotifyPlayerProvider] Error during play request:", error);
      throw error;
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
    <SpotifyPlayerContext.Provider
      value={{ ...playerState, player, play, pause, resume, seek }}
    >
      {children}
    </SpotifyPlayerContext.Provider>
  );
};

export const useSpotifyPlayer = () => {
  const context = useContext(SpotifyPlayerContext);
  if (context === undefined) {
    throw new Error(
      "useSpotifyPlayer must be used within a SpotifyPlayerProvider",
    );
  }
  return context;
};
