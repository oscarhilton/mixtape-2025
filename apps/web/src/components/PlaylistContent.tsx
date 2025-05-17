'use client';

import React, { useState, useEffect } from 'react';
import { PlaylistEntry } from './PlaylistEntry';
import { PlaybackControls } from "@/components/PlaybackControls";
import { TrackCommentsDisplay } from "@/components/TrackCommentsDisplay";
import { useSpotifyPlayer } from '@repo/shared-contexts';

// Keep the Playlist and Comment interfaces here or move to a types file
interface Playlist {
  id: number;
  name: string;
  spotify_playlist_id: string;
  description?: string;
  votes: number;
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
  album: { name: string, images: { url: string }[] };
  uri: string;
  duration_ms: number;
}

interface PlaylistContentProps {
  initialPlaylists: Playlist[];
  initialComments: Comment[];
  initialCurrentPlaylistId: number | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const PlaylistContent: React.FC<PlaylistContentProps> = ({ 
  initialPlaylists,
  initialComments,
  initialCurrentPlaylistId 
}) => {
  console.log('[PlaylistContent] Initializing/Re-rendering. Initial Props:', { initialPlaylists, initialComments, initialCurrentPlaylistId });

  const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [currentDbPlaylistId, setCurrentDbPlaylistId] = useState<number | null>(initialCurrentPlaylistId);
  const [activeSpotifyPlaylistId, setActiveSpotifyPlaylistId] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const { play: startPlayback, deviceId, currentTrack } = useSpotifyPlayer();

  useEffect(() => {
    setPlaylists(initialPlaylists); // Update playlists from props

    if (initialPlaylists.length > 0) {
      const firstPlaylist = initialPlaylists[0]; // Get the first playlist
      if (firstPlaylist) { // Explicit check for the playlist object itself
        const firstPlaylistId = firstPlaylist.id;
        if (!currentDbPlaylistId || !initialPlaylists.some(p => p.id === currentDbPlaylistId)) {
          console.log(`[PlaylistContent] Setting currentDbPlaylistId to first available: ${firstPlaylistId}`);
          setCurrentDbPlaylistId(firstPlaylistId);
        }
      }
    } else {
      if (currentDbPlaylistId !== null) {
        console.log('[PlaylistContent] No initial playlists, clearing currentDbPlaylistId.');
        setCurrentDbPlaylistId(null);
      }
    }
  }, [initialPlaylists, currentDbPlaylistId]);

  useEffect(() => {
    console.log('[PlaylistContent] Prop initialComments changed. Setting comments state:', initialComments);
    setComments(initialComments);
  }, [initialComments]);

  useEffect(() => {
    // This effect runs when component mounts with initialCurrentPlaylistId or when it changes from outside (though less likely for this state var)
    console.log('[PlaylistContent] Prop initialCurrentPlaylistId changed or onMount. Setting currentDbPlaylistId state:', initialCurrentPlaylistId);
    setCurrentDbPlaylistId(initialCurrentPlaylistId);
  }, [initialCurrentPlaylistId]);


  useEffect(() => {
    console.log('[PlaylistContent] currentDbPlaylistId state changed to:', currentDbPlaylistId);
    if (currentDbPlaylistId) {
      console.log(`[PlaylistContent] Fetching comments for DB playlist ID: ${currentDbPlaylistId}`);
      fetch(`${API_URL}/playlists/${currentDbPlaylistId}/comments`, { cache: 'no-store' })
        .then(res => {
            if (!res.ok) throw new Error(`Failed to fetch comments: ${res.status}`);
            return res.json();
        })
        .then(data => {
            console.log(`[PlaylistContent] Fetched comments for ${currentDbPlaylistId}:`, data);
            setComments(data);
        })
        .catch(err => console.error("[PlaylistContent] Failed to fetch comments for playlist", currentDbPlaylistId, err));
    } else {
      console.log('[PlaylistContent] currentDbPlaylistId is null, clearing comments.');
      setComments([]); // Clear comments if no playlist is selected
    }
  }, [currentDbPlaylistId]);

  useEffect(() => {
    // If the current track changes, try to find which DB playlist it belongs to
    // This is a bit indirect. A better way would be to directly know the context.
    if (currentTrack && currentTrack.album && currentTrack.album.uri) {
        const trackAlbumUri = currentTrack.album.uri;
        // The album URI might be part of a playlist context URI (spotify:playlist:PLAYLIST_ID)
        // Or if playing a single track, it might be spotify:album:ALBUM_ID
        // For now, if a playlist was explicitly played, activeSpotifyPlaylistId is set.
        console.log('[PlaylistContent] currentTrack changed:', currentTrack.name, 'album URI:', trackAlbumUri);
    }
  }, [currentTrack, playlists]);

  const fetchPlaylistTracks = async (spotifyPlaylistId: string) => {
    if (!spotifyPlaylistId) return;
    console.log(`[PlaylistContent] Fetching tracks for Spotify playlist ID: ${spotifyPlaylistId}`);
    try {
      const response = await fetch(`${API_URL}/spotify/playlist/${spotifyPlaylistId}/tracks`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tracks for playlist ${spotifyPlaylistId}`);
      }
      const tracksData = await response.json();
      // Backend returns an array of tracks directly, not nested under .items for this endpoint
      setPlaylistTracks(tracksData); 
      console.log(`Fetched tracks for ${spotifyPlaylistId}:`, tracksData);
    } catch (error) {
      console.error('Error fetching playlist tracks:', error);
      setPlaylistTracks([]);
    }
  };

  const handlePlayPlaylist = (spotifyPlaylistId: string) => {
    console.log("[PlaylistContent] Play triggered for Spotify Playlist ID:", spotifyPlaylistId);
    const dbPlaylist = playlists.find(p => p.spotify_playlist_id === spotifyPlaylistId);
    if (dbPlaylist) {
      console.log("[PlaylistContent] Corresponding DB playlist found, ID:", dbPlaylist.id, "Setting as currentDbPlaylistId.");
      setCurrentDbPlaylistId(dbPlaylist.id);
    }
    setActiveSpotifyPlaylistId(spotifyPlaylistId);
    fetchPlaylistTracks(spotifyPlaylistId);
  };

  const handlePlayTrack = async (trackUri: string, contextUriFromClick?: string) => {
    if (!deviceId) {
      alert('Spotify player not ready.');
      return;
    }
    console.log(`[PlaylistContent] Clicked track. Attempting to play track URI: ${trackUri}, with context URI from click: ${contextUriFromClick}`);
    try {
      let playOptions: { contextUri?: string; uris?: string[]; offset?: { uri?: string }; position_ms?: number } = {};

      if (contextUriFromClick) { 
        console.log(`[PlaylistContent] Playing from context: ${contextUriFromClick}. Specific track URI for offset: ${trackUri}`);
        playOptions.contextUri = contextUriFromClick;
        playOptions.offset = { uri: trackUri }; 
      } else { 
        console.log(`[PlaylistContent] Playing track directly (no context): ${trackUri}`);
        playOptions.uris = [trackUri];
      }
      
      console.log('[PlaylistContent] Constructed playOptions to send to SpotifyPlayerContext:', playOptions);
      await startPlayback(playOptions); 

      if (contextUriFromClick && contextUriFromClick.startsWith('spotify:playlist:')) {
        const sId = contextUriFromClick.split(':')[2];
        if (activeSpotifyPlaylistId !== sId) {
            console.log("[PlaylistContent] Track context changed. New activeSpotifyPlaylistId:", sId);
            setActiveSpotifyPlaylistId(sId || null);
            const dbPlaylist = playlists.find(p => p.spotify_playlist_id === sId);
            if (dbPlaylist) {
                console.log("[PlaylistContent] Corresponding DB playlist found for track context, ID:", dbPlaylist.id);
                setCurrentDbPlaylistId(dbPlaylist.id);
            }
            if (sId && (!playlistTracks.length || activeSpotifyPlaylistId !== sId)) {
                 fetchPlaylistTracks(sId);
            }
        }
      }
    } catch (error) {
      console.error(`[PlaylistContent] Error starting track playback:`, error);
    }
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 p-4 md:p-6">
      {/* Left Column: Playlist Entries */}
      <div className="md:col-span-1 space-y-6"> {/* Adjusted col-span for a more typical 1/3 : 2/3 or fixed width sidebar */}
        <h2 className="text-2xl font-semibold mb-4 text-white">Your Playlists</h2>
        {/* Collaborative Curation Controls - Placeholder for future integration */}
        {/* 
        <div className="space-y-3 mb-6">
          <button className="w-full flex items-center justify-center py-2 px-4 bg-spotify-green text-white rounded-md hover:bg-opacity-80 transition-colors font-medium">
            <PlusIcon className="w-5 h-5 mr-2" /> Add Tracks to Current
          </button>
          <button className="w-full flex items-center justify-center py-2 px-4 bg-spotify-light-dark text-spotify-light-gray rounded-md hover:bg-spotify-gray transition-colors font-medium">
            <UserPlusIcon className="w-5 h-5 mr-2" /> Invite Collaborators
          </button>
        </div>
        */}
        {playlists.length > 0 ? (
          <ul className="space-y-4">
            {playlists.map((playlist) => (
              <PlaylistEntry 
                key={playlist.id} 
                playlist={playlist} 
                onPlay={handlePlayPlaylist} 
              />
            ))}
          </ul>
        ) : (
          <p className="text-spotify-light-gray text-center">No playlists found. Add one to get started!</p>
        )}
      </div>

      {/* Right Column: Tracklist, Controls, Comments */}
      <div className="md:col-span-2 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-white">Tracklist</h2>
          {activeSpotifyPlaylistId && playlistTracks.length > 0 ? (
            <div className="bg-spotify-light-dark p-4 rounded-lg shadow-lg max-h-[calc(100vh-250px)] overflow-y-auto"> {/* Adjusted max-h for viewport */}
              <h3 className="text-lg font-semibold mb-3 text-white sticky top-0 bg-spotify-light-dark py-2 z-10">
                Playing from: {playlists.find(p => p.spotify_playlist_id === activeSpotifyPlaylistId)?.name || 'Selected Playlist'}
              </h3>
              <ul className="space-y-1">
                {playlistTracks.map((track, index) => (
                  <li 
                    key={track.id + index} 
                    className="p-2 hover:bg-spotify-gray rounded-md cursor-pointer flex items-center space-x-3 transition-colors duration-150 group"
                    onClick={() => handlePlayTrack(track.uri, `spotify:playlist:${activeSpotifyPlaylistId}`)}
                  >
                    {track.album.images?.[0]?.url ? (
                      <img src={track.album.images[0].url} alt={track.album.name} className="w-10 h-10 rounded-spotify-sm object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-spotify-sm bg-spotify-gray flex items-center justify-center">
                        {/* Placeholder Icon for missing album art */}
                        <svg className="w-5 h-5 text-spotify-light-gray" fill="currentColor" viewBox="0 0 20 20"><path d="M10 3a1 1 0 00-1 1v4a1 1 0 00.82.977A7.004 7.004 0 0117 10a7 7 0 11-8.18-6.977A1 1 0 0010 4V3zM8 16a6 6 0 100-12 6 6 0 000 12z"></path><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"></path></svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0"> {/* For truncation to work */}
                      <p className={`font-medium truncate group-hover:text-spotify-green ${currentTrack?.uri === track.uri ? 'text-spotify-green' : 'text-white'}`}>
                        {track.name}
                      </p>
                      <p className="text-sm text-spotify-light-gray truncate">
                        {track.artists.map(a => a.name).join(', ')}
                      </p>
                    </div>
                    <span className="text-sm text-spotify-light-gray">
                      {Math.floor((track.duration_ms || 0) / 60000)}:
                      {(((track.duration_ms || 0) % 60000) / 1000).toFixed(0).padStart(2, '0')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : activeSpotifyPlaylistId ? (
            <p className="text-spotify-light-gray mt-4 text-center py-10">Loading tracks or this playlist is empty...</p>
          ) : (
            <p className="text-spotify-light-gray mt-4 text-center py-10">Select a playlist to see its tracks and start listening.</p>
          )}
        </div>

        <div className="mt-auto"> {/* Pushes controls and comments towards bottom if tracklist is short */}
          <div className="bg-spotify-light-dark p-4 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-3 text-white">Player Controls & Timeline Comments</h3>
            <PlaybackControls currentPlaylistId={currentDbPlaylistId} />
          </div>

          {currentDbPlaylistId && (
            <div className="mt-6">
              {/* TrackCommentsDisplay is a fixed overlay, so no specific layout needed here other than ensuring it's rendered */}
              <TrackCommentsDisplay 
                playlistId={currentDbPlaylistId} 
                comments={comments} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 