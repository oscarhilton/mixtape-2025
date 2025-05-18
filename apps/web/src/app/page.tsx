'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@repo/shared-contexts';
// import { LoginButton, LogoutButton } from "@repo/shared-ui"; // Commented out until exports are verified
import {
  PlaybackControls,
  PlaylistContent,
  UserPlaylists,
  SpotifyRecorderControl,
  SavedRecordingsList
} from '@/components';

// Removed Playlist and Comment interfaces as they were part of server-side fetching logic
// Removed fetchPlaylists and fetchCommentsForPlaylist functions

export default function Web() {
  const { user, isLoading } = useAuth();
  const [activeDbPlaylistId, setActiveDbPlaylistId] = useState<number | null>(null);

  const handlePlaylistSelected = useCallback((playlistId: number | null) => {
    setActiveDbPlaylistId(playlistId);
    // Future: Could also trigger fetching comments for this playlistId here
    // or PlaylistContent can fetch its own comments based on activeDbPlaylistId prop.
  }, []);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen bg-gray-900 text-white"><p>Loading session...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-gray-900 text-white p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 pb-4 border-b border-gray-700">
        <h1 className="text-4xl font-bold text-sky-400 mb-4 md:mb-0">Mixtape In A Bottle</h1>
        {user ? (
          <div className="flex items-center space-x-4">
            <span className="text-lg">Welcome, <span className="font-semibold text-sky-300">{user.display_name || user.spotify_id}</span>!</span>
            {/* <LogoutButton /> */}{/* Commented out */}
          </div>
        ) : (
          // <LoginButton /> // Commented out
          <p className="text-lg">Please log in.</p> // Placeholder for LoginButton
        )}
      </header>

      {user ? (
        <main className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-4 space-y-6">
              <UserPlaylists 
                onPlaylistSelected={handlePlaylistSelected} 
                activePlaylistId={activeDbPlaylistId} 
              />
              <SpotifyRecorderControl />
              <SavedRecordingsList />
            </div>
            <div className="md:col-span-8 space-y-6">
              <PlaylistContent activeDbPlaylistId={activeDbPlaylistId} />
            </div>
          </div>
          <footer className="mt-12 pt-6 border-t border-gray-700">
            <PlaybackControls />
          </footer>
        </main>
      ) : (
        <div className="text-center py-10">
          <p className="text-xl text-gray-400">Please log in to create and share your mixtapes.</p>
        </div>
      )}
    </div>
  );
}
