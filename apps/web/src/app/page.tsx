// import { PlaybackControls } from "@/components/PlaybackControls"; // Moved to PlaylistContent
// import { TrackCommentsDisplay } from "@/components/TrackCommentsDisplay"; // Moved to PlaylistContent
import { PlaylistContent } from '@/components/PlaylistContent';
// import { AddPlaylistModal } from "@/components/AddPlaylistModal"; // Commented out for now
// import { PlaylistGrid } from "@/components/PlaylistGrid"; // Commented out for now
import { PlaybackControls } from "@/components/PlaybackControls"; // Assuming this will be moved later
// import { VoteButton } from "shared-ui"; // Updated import for VoteButton
import { logger, API_URL, ErrorBoundary } from '@repo/shared-ui';

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

async function fetchPlaylists(): Promise<Playlist[]> {
  try {
    const response = await fetch(`${API_URL}/playlists`, { cache: 'no-store' });
    if (!response.ok) {
      logger.error(`HTTP error! status: ${response.status}`, await response.text().catch(() => 'Failed to get error text'));
      throw new Error(`Failed to fetch playlists. Status: ${response.status}`);
    }
    const playlists = await response.json();
    logger.log("Fetched playlists:", playlists);
    return playlists;
  } catch (error) {
    logger.error("Error in fetchPlaylists:", error);
    return []; // Return empty array on error
  }
}

async function fetchCommentsForPlaylist(playlistId: number): Promise<Comment[]> {
  if (!playlistId) return [];
  try {
    const response = await fetch(`${API_URL}/playlists/${playlistId}/comments`, { cache: 'no-store' });
    if (!response.ok) {
      logger.error(`HTTP error fetching comments! status: ${response.status}`, await response.text().catch(() => 'Failed to get error text'));
      throw new Error(`Failed to fetch comments for playlist ${playlistId}. Status: ${response.status}`);
    }
    const comments = await response.json();
    logger.log(`Fetched comments for playlist ${playlistId}:`, comments);
    return comments;
  } catch (error) {
    logger.error(`Error in fetchCommentsForPlaylist for playlist ${playlistId}:`, error);
    return [];
  }
}

export default async function Home() {
  const playlists = await fetchPlaylists();
  const firstPlaylist = playlists[0];
  const initialComments = firstPlaylist ? await fetchCommentsForPlaylist(firstPlaylist.id) : [];
  const initialCurrentPlaylistId = firstPlaylist?.id ?? null;

  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-spotify-dark text-white">
        <PlaylistContent
          initialPlaylists={playlists}
          initialComments={initialComments}
          initialCurrentPlaylistId={initialCurrentPlaylistId}
        />
      </main>
    </ErrorBoundary>
  );
}
