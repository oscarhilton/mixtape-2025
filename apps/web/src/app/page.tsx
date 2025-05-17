// import { PlaybackControls } from "@/components/PlaybackControls"; // Moved to PlaylistContent
// import { TrackCommentsDisplay } from "@/components/TrackCommentsDisplay"; // Moved to PlaylistContent
import { PlaylistContent } from '@/components/PlaylistContent';
// import { AddPlaylistModal } from "@/components/AddPlaylistModal"; // Commented out for now
// import { PlaylistGrid } from "@/components/PlaylistGrid"; // Commented out for now
import { PlaybackControls } from "@/components/PlaybackControls"; // Assuming this will be moved later
// import { VoteButton } from "shared-ui"; // Updated import for VoteButton

// Removed client-side hooks: useAuth, useSpotifyPlayer, useEffect, useState

interface Playlist {
  id: number;
  name: string;
  spotify_playlist_id: string;
  description?: string;
  votes: number;
  created_at: string;
  updated_at: string;
}

// Define the Comment interface based on the database table
interface Comment {
  id: number;
  playlist_id: number;
  user_id: number;
  track_uri: string;
  timestamp_ms: number;
  comment_text: string;
  created_at: string;
  updated_at: string;
  // Potentially join user display_name if fetched from backend, or handle on client
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchPlaylists(): Promise<Playlist[]> {
  try {
    const response = await fetch(`${API_URL}/playlists`, { cache: 'no-store' });
    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`, await response.text().catch(() => 'Failed to get error text'));
      throw new Error(`Failed to fetch playlists. Status: ${response.status}`);
    }
    const playlists = await response.json();
    console.log("Fetched playlists:", playlists);
    return playlists;
  } catch (error) {
    console.error("Error in fetchPlaylists:", error);
    return []; // Return empty array on error
  }
}

async function fetchCommentsForPlaylist(playlistId: number): Promise<Comment[]> {
  if (!playlistId) return [];
  try {
    const response = await fetch(`${API_URL}/playlists/${playlistId}/comments`, { cache: 'no-store' });
    if (!response.ok) {
      console.error(`HTTP error fetching comments! status: ${response.status}`, await response.text().catch(() => 'Failed to get error text'));
      throw new Error(`Failed to fetch comments for playlist ${playlistId}. Status: ${response.status}`);
    }
    const comments = await response.json();
    console.log(`Fetched comments for playlist ${playlistId}:`, comments);
    return comments;
  } catch (error) {
    console.error(`Error in fetchCommentsForPlaylist for playlist ${playlistId}:`, error);
    return [];
  }
}

export default async function Page() {
  const playlists = await fetchPlaylists();
  const currentPlaylistId = playlists.length > 0 ? playlists[0].id : null;
  let currentPlaylistComments: Comment[] = [];

  if (currentPlaylistId) {
    currentPlaylistComments = await fetchCommentsForPlaylist(currentPlaylistId);
  }

  // Placeholder function for onCommentsUpdated - REMOVED
  // const handleCommentsUpdated = () => {
  //   console.log("[Page] Comments updated, placeholder for refetch logic.");
  // };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Music Sharing Thing</h1>
      
      <PlaylistContent 
        initialPlaylists={playlists}
        initialComments={currentPlaylistComments}
        initialCurrentPlaylistId={currentPlaylistId}
      />

      {/* Removed direct rendering of PlaybackControls, TrackCommentsDisplay, and playlist iteration */}
      {/* <AddPlaylistModal /> Re-add later if needed */}
    </main>
  );
}
