"use client";

import React, { useState, useEffect } from "react";
// import { PlaylistEntry } from "./PlaylistEntry"; // PlaylistEntry is likely not needed if UserPlaylists handles selection
// import { PlaybackControls } from "@/components/PlaybackControls";
import { useSpotifyPlayer } from "@repo/shared-contexts";
import { logger, API_URL } from "@repo/shared-ui";
import { LyricsStyleComments } from "./LyricsStyleComments";
import { CommentInput } from "@/components/CommentInput";
import Image from "next/image";

// Keep the Playlist and Comment interfaces here or move to a types file
interface Playlist {
  id: number;
  name: string;
  spotify_playlist_id: string;
  description?: string;
  votes?: number;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: number;
  playlist_id: number;
  user_id: number;
  track_uri: string;
  timestamp_ms: number;
  comment_text: string;
  created_at: string;
  updated_at: string;
}

interface Track {
  id: string; // Spotify track ID
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  uri: string;
  duration_ms: number;
}

interface PlaylistContentProps {
  // activeDbPlaylistId is the ID of the playlist selected in UserPlaylists
  activeDbPlaylistId: number | null;
}

export const PlaylistContent: React.FC<PlaylistContentProps> = ({
  activeDbPlaylistId,
}) => {
  console.log(
    "[PlaylistContent] Initializing/Re-rendering. Active DB Playlist ID:",
    activeDbPlaylistId,
  );

  const [currentPlaylistDetails, setCurrentPlaylistDetails] = useState<Playlist | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [isLoadingPlaylistDetails, setIsLoadingPlaylistDetails] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { play: startPlayback, deviceId, currentTrack } = useSpotifyPlayer();

  // Fetch playlist details when activeDbPlaylistId changes
  useEffect(() => {
    const fetchDetails = async () => {
      if (!activeDbPlaylistId) {
        setCurrentPlaylistDetails(null);
        setPlaylistTracks([]);
        setComments([]);
        setError(null);
        return;
      }
      setIsLoadingPlaylistDetails(true);
      setError(null);
      try {
        // First, fetch the details of the selected playlist (name, spotify_playlist_id etc.)
        const detailsResponse = await fetch(`${API_URL}/api/playlists/${activeDbPlaylistId}`, {
          cache: "no-store", // Or your preferred caching strategy
        });
        if (!detailsResponse.ok) {
          throw new Error(`Failed to fetch playlist details: ${detailsResponse.status}`);
        }
        const playlistData: Playlist = await detailsResponse.json();
        setCurrentPlaylistDetails(playlistData);
        
        // If playlist details are fetched successfully, then fetch its tracks
        if (playlistData.spotify_playlist_id) {
          await fetchPlaylistTracks(playlistData.spotify_playlist_id);
        } else {
          setPlaylistTracks([]); // No spotify ID, no tracks
        }

      } catch (err) {
        console.error("[PlaylistContent] Error fetching playlist details:", err);
        setError((err instanceof Error) ? err.message : "Could not fetch playlist details.");
        setCurrentPlaylistDetails(null);
        setPlaylistTracks([]);
      }
      setIsLoadingPlaylistDetails(false);
    };

    fetchDetails();
  }, [activeDbPlaylistId]);

  // Fetch comments when activeDbPlaylistId changes
  useEffect(() => {
    const fetchCommentsForPlaylist = async () => {
      if (!activeDbPlaylistId) {
        setComments([]);
        return;
      }
      setIsLoadingComments(true);
      try {
        logger.log(
          `[PlaylistContent] Fetching comments for DB playlist ID: ${activeDbPlaylistId}`,
        );
        const commentsResponse = await fetch(`${API_URL}/playlists/${activeDbPlaylistId}/comments`, {
          cache: "no-store",
        });
        if (!commentsResponse.ok) {
          throw new Error(`Failed to fetch comments: ${commentsResponse.status}`);
        }
        const commentsData: Comment[] = await commentsResponse.json();
        setComments(commentsData);
      } catch (err) {
        logger.error(
          "[PlaylistContent] Failed to fetch comments for playlist",
          activeDbPlaylistId,
          err,
        );
        setComments([]); // Clear comments on error
      }
      setIsLoadingComments(false);
    };
    fetchCommentsForPlaylist();
  }, [activeDbPlaylistId]);

  const fetchPlaylistTracks = async (spotifyPlaylistId: string) => {
    if (!spotifyPlaylistId) return;
    setIsLoadingTracks(true);
    console.log(
      `[PlaylistContent] Fetching tracks for Spotify playlist ID: ${spotifyPlaylistId}`,
    );
    try {
      const response = await fetch(
        `${API_URL}/spotify/playlist/${spotifyPlaylistId}/tracks`,
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch tracks for playlist ${spotifyPlaylistId}`,
        );
      }
      const tracksData = await response.json();
      setPlaylistTracks(tracksData);
      console.log(`Fetched tracks for ${spotifyPlaylistId}:`, tracksData);
    } catch (error) {
      console.error("Error fetching playlist tracks:", error);
      setPlaylistTracks([]);
    }
    setIsLoadingTracks(false);
  };

  const handlePlayTrack = async (trackUri: string) => {
    console.log("[PlaylistContent] Track clicked:", {
      trackUri,
      deviceId,
      hasContext: !!currentPlaylistDetails?.spotify_playlist_id,
      contextUri: currentPlaylistDetails?.spotify_playlist_id ? `spotify:playlist:${currentPlaylistDetails.spotify_playlist_id}` : undefined
    });

    if (!deviceId) {
      console.error("[PlaylistContent] Cannot play track: No device ID available");
      alert("Spotify player not ready.");
      return;
    }

    const spotifyContextUri = currentPlaylistDetails?.spotify_playlist_id
      ? `spotify:playlist:${currentPlaylistDetails.spotify_playlist_id}`
      : undefined;

    try {
      const playOptions: {
        contextUri?: string;
        uris?: string[];
        offset?: { uri?: string };
        position_ms?: number;
      } = {};

      if (spotifyContextUri) {
        playOptions.contextUri = spotifyContextUri;
        playOptions.offset = { uri: trackUri }; // Play this specific track within the context
        console.log("[PlaylistContent] Playing track in context:", {
          contextUri: spotifyContextUri,
          trackUri
        });
      } else {
        playOptions.uris = [trackUri]; // Play track directly if no context
        console.log("[PlaylistContent] Playing track directly:", {
          uris: [trackUri]
        });
      }

      await startPlayback(playOptions);
    } catch (error) {
      console.error("[PlaylistContent] Error starting track playback:", error);
      alert("Failed to play track. Please try again.");
    }
  };

  // Loading states combined for simplicity, can be more granular
  const isLoading = isLoadingPlaylistDetails || isLoadingTracks || isLoadingComments;

  if (!activeDbPlaylistId) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p>Select a playlist to view its content.</p>
      </div>
    );
  }

  if (isLoading && !currentPlaylistDetails) { // Show initial loading only if no details yet
    return <p className="text-center p-4 text-gray-400">Loading playlist content...</p>;
  }

  if (error && !currentPlaylistDetails) { // Show error if loading details failed and no details yet
    return <p className="text-center p-4 text-red-500">Error: {error}</p>;
  }
  
  if (!currentPlaylistDetails && !isLoading) { // No active playlist and not loading
    return (
      <div className="p-6 text-center text-gray-400">
        <p>Playlist not found or could not be loaded.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 p-6 w-full">
        {/* Left Column: Removed Playlist Entries as UserPlaylists handles this */}
        {/* Center Column: Tracklist - Now takes full width or adjusted span */}
        <div className="md:col-span-7 space-y-6"> {/* Adjusted span */}
          {currentPlaylistDetails && (
            <div className="bg-spotify-light-dark rounded-lg shadow-lg max-h-[calc(100vh-250px)] overflow-y-auto">
              <div className="sticky bg-spotify-light-dark top-0 p-4 z-10">
                <h3 className="text-spotify-light-gray text-2xl font-semibold pb-3">
                  {currentPlaylistDetails.name || "Selected Playlist"}
                </h3>
                {currentPlaylistDetails.description && <p className="text-sm text-gray-400">{currentPlaylistDetails.description}</p>}
                {isLoadingTracks && <p className="text-sm text-gray-500">Loading tracks...</p>}
              </div>
              {playlistTracks.length > 0 ? (
                <ul className="space-y-1 p-2">
                  {playlistTracks.map((track, index) => (
                    <li
                      key={track.id + index}
                      className={`p-2 hover:bg-spotify-gray rounded-md cursor-pointer flex items-center space-x-3 transition-colors duration-150 group
                      ${currentTrack?.uri === track.uri ? "bg-spotify-gray text-spotify-green" : "text-spotify-light-gray"}`}
                      onClick={() => handlePlayTrack(track.uri)}
                    >
                      {track.album.images?.[0]?.url ? (
                        <Image
                          src={track.album.images[0].url}
                          alt={track.album.name}
                          className="w-10 h-10 rounded-md object-cover"
                          width={40}
                          height={40}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-spotify-gray flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-spotify-light-gray"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 3a1 1 0 00-1 1v4a1 1 0 00.82.977A7.004 7.004 0 0117 10a7 7 0 11-8.18-6.977A1 1 0 0010 4V3zM8 16a6 6 0 100-12 6 6 0 000 12z"></path>
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium truncate group-hover:text-spotify-green ${currentTrack?.uri === track.uri ? "text-spotify-green" : ""}`}
                        >
                          {track.name}
                        </p>
                        <p className="text-sm text-spotify-light-gray truncate">
                          {track.artists.map((a) => a.name).join(", ")}
                        </p>
                      </div>
                      <span className="text-sm text-spotify-light-gray">
                        {Math.floor((track.duration_ms || 0) / 60000)}:
                        {(((track.duration_ms || 0) % 60000) / 1000)
                          .toFixed(0)
                          .padStart(2, "0")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : !isLoadingTracks && (
                <p className="text-spotify-light-gray text-center py-10 p-4">
                  This playlist is empty or tracks could not be loaded.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Comments & Input (was Player Controls & Comments) */}
        <div className="md:col-span-5 space-y-6"> {/* Adjusted span */}
          {currentPlaylistDetails && currentTrack && (
            <div className="space-y-6">
              <LyricsStyleComments
                comments={comments}
                currentTrackUri={currentTrack.uri}
              />
              <div className="bg-spotify-light-dark p-4 rounded-lg shadow-lg">
                <CommentInput playlistId={currentPlaylistDetails.id} />
              </div>
            </div>
          )}
          {currentPlaylistDetails && !currentTrack && (
            <p className="text-sm text-gray-500 p-4">Play a track to see comments.</p>
          )}
        </div>
      </div>
      {/* PlaybackControls might be better in a global layout or footer, but keeping for now if it fits the design */}
      {/* <div className="bg-spotify-light-dark p-4 rounded-lg">
        <PlaybackControls /> 
      </div> */}
    </div>
  );
};
