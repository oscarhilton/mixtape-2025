'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@repo/shared-contexts';

// Match this interface with the structure of your playlist data from the API
interface Playlist {
  id: number;
  name: string;
  spotify_playlist_id: string;
  description?: string;
  votes?: number; 
  created_at: string;
  // Add other fields like segmentCount or cover image if available/needed
}

interface UserPlaylistsProps {
  onPlaylistSelected: (playlistId: number | null) => void;
  // Prop to receive the currently active playlist ID from parent, to highlight it
  activePlaylistId?: number | null; 
}

export function UserPlaylists({ onPlaylistSelected, activePlaylistId }: UserPlaylistsProps) {
  const { user } = useAuth(); // To ensure user is logged in before fetching
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserPlaylists = async () => {
      if (!user) {
        setIsLoading(false);
        // setError("Please log in to view playlists."); // Or simply show no playlists
        setPlaylists([]); // Clear playlists if user logs out
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/playlists', { // Fetches from GET /api/playlists
          credentials: 'include', 
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ message: 'Failed to fetch playlists' }));
          throw new Error(errData.message || `Error: ${response.status}`);
        }
        const data: Playlist[] = await response.json();
        setPlaylists(data);
      } catch (err: unknown) {
        console.error("Error fetching user playlists:", err);
        setError((err instanceof Error) ? err.message : 'Could not fetch playlists.');
      }
      setIsLoading(false);
    };

    fetchUserPlaylists();
  }, [user]); // Refetch if user changes

  if (isLoading) {
    return <p className="text-center p-4 text-gray-400">Loading playlists...</p>;
  }

  if (error) {
    return <p className="text-center p-4 text-red-500">Error: {error}</p>;
  }

  if (!user) {
    // Optionally, show a login prompt or nothing
    return <p className="text-center p-4 text-yellow-300">Please log in to see playlists.</p>;
  }
  
  if (playlists.length === 0) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg text-center">
        <p className="text-gray-400">No playlists found.</p>
        {/* Optionally, add a button/link to a page where users can create playlists */}
        {/* <button className="mt-2 px-3 py-1 bg-sky-600 hover:bg-sky-700 rounded text-sm">Create Playlist</button> */}
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-3 text-sky-400">Playlists</h2>
      <ul className="space-y-2 max-h-96 overflow-y-auto">
        {playlists.map((playlist) => (
          <li key={playlist.id}>
            <button 
              onClick={() => onPlaylistSelected(playlist.id)}
              className={`w-full text-left px-3 py-2 rounded-md transition-colors ${activePlaylistId === playlist.id ? 'bg-sky-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
            >
              {playlist.name}
              {playlist.description && <p className="text-xs text-gray-400 truncate">{playlist.description}</p>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
} 