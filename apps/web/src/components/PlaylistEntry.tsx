'use client';

import React, { useState } from 'react';
import { useSpotifyPlayer } from '@repo/shared-contexts';
import { useAuth } from '@repo/shared-contexts';
import { useRouter } from 'next/navigation';
import { Button } from "@repo/shared-ui";

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

export const PlaylistEntry: React.FC<PlaylistEntryProps> = ({ playlist, onPlay }) => {
  const { play: startPlayback, deviceId } = useSpotifyPlayer();
  const { user } = useAuth();

  const handlePlayPlaylist = async () => {
    if (!user) {
      alert('Please login to play music.');
      return;
    }
    if (!deviceId) {
      alert('Spotify player not ready. Ensure you have a Spotify Premium account and the player is active.');
      return;
    }
    const spotifyPlaylistUri = `spotify:playlist:${playlist.spotify_playlist_id}`;
    console.log(`[PlaylistEntry] Attempting to play playlist URI: ${spotifyPlaylistUri} on device: ${deviceId}`);
    try {
      await startPlayback({ contextUri: spotifyPlaylistUri });
      onPlay(playlist.spotify_playlist_id); // Notify parent about which playlist is playing
      console.log(`[PlaylistEntry] Play command issued for ${playlist.name}`);
    } catch (error) {
      console.error(`[PlaylistEntry] Error starting playback for ${playlist.name}:`, error);
      alert(`Failed to play playlist: ${playlist.name}. Check console for details.`);
    }
  };

  return (
    <li className="p-4 border rounded-lg shadow-sm bg-white">
      <h3 className="text-xl font-semibold text-gray-800">{playlist.name}</h3>
      {playlist.description && <p className="text-gray-600 mt-1">{playlist.description}</p>}
      <p className="text-sm text-gray-500 mt-2">Votes: {playlist.votes}</p>
      <button
        onClick={handlePlayPlaylist}
        disabled={!user || !deviceId}
        className="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
      >
        Play Playlist
      </button>
      {/* VoteButton can be re-added here if needed */}
      {/* <VoteButton playlistId={playlist.id} initialVotes={playlist.votes} /> */}
    </li>
  );
}; 