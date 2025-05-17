"use client";

import React from "react";
import { useSpotifyPlayer } from "@repo/shared-contexts";
import { useAuth } from "@repo/shared-contexts";
import { VoteButton } from '@repo/shared-ui'; // Temporarily commented out

interface Playlist {
  id: number;
  name: string;
  spotify_playlist_id: string;
  description?: string;
  votes: number;
}

interface PlaylistEntryProps {
  playlist: Playlist;
  onPlay: (playlistId: string) => void; // Callback to notify page of active playlist
}

export const PlaylistEntry: React.FC<PlaylistEntryProps> = ({
  playlist,
  onPlay,
}) => {
  const { play: startPlayback, deviceId } = useSpotifyPlayer();
  const { user } = useAuth();

  const handlePlayPlaylist = async () => {
    if (!user) {
      alert("Please login to play music.");
      return;
    }
    if (!deviceId) {
      alert(
        "Spotify player not ready. Ensure you have a Spotify Premium account and the player is active.",
      );
      return;
    }
    const spotifyPlaylistUri = `spotify:playlist:${playlist.spotify_playlist_id}`;
    console.log(
      `[PlaylistEntry] Attempting to play playlist URI: ${spotifyPlaylistUri} on device: ${deviceId}`,
    );
    try {
      await startPlayback({ contextUri: spotifyPlaylistUri });
      onPlay(playlist.spotify_playlist_id); // Notify parent about which playlist is playing
      console.log(`[PlaylistEntry] Play command issued for ${playlist.name}`);
    } catch (error) {
      console.error(
        `[PlaylistEntry] Error starting playback for ${playlist.name}:`,
        error,
      );
      alert(
        `Failed to play playlist: ${playlist.name}. Check console for details.`,
      );
    }
  };

  return (
    <li className="bg-spotify-light-dark dark:bg-spotify-light-dark rounded-lg shadow-xl p-4 flex flex-col gap-3 hover:bg-spotify-gray transition-colors duration-150">
      <h3 className="text-base font-bold mb-0.5 truncate text-spotify-light-gray">{playlist.name}</h3>
      {playlist.description && (
        <p className="text-spotify-light-gray text-xs mb-1 line-clamp-2">
          {playlist.description}
        </p>
      )}
      <p className="text-xs text-spotify-light-gray">Votes: {playlist.votes}</p>
      <button
        onClick={handlePlayPlaylist}
        disabled={!user || !deviceId}
        className="mt-auto px-4 py-2 bg-spotify-green text-sm rounded-full font-semibold shadow-md hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-spotify-light-dark disabled:bg-spotify-gray disabled:cursor-not-allowed transition-transform hover:scale-105 active:scale-100"
      >
        Play Playlist
      </button>
      <VoteButton playlistId={playlist.id} initialVotes={playlist.votes} />
    </li>
  );
};
