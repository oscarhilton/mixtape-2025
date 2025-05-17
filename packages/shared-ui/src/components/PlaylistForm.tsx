"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@repo/shared-contexts";
import { LocationInput } from "./LocationInput";
import MixtapeSticker from "./MixtapeSticker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Location {
  latitude: number | null;
  longitude: number | null;
  address?: string;
}

export default function PlaylistForm() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [name, setName] = useState("");
  const [spotifyPlaylistUrl, setSpotifyPlaylistUrl] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingName, setIsFetchingName] = useState(false);
  const [location, setLocation] = useState<Location>({
    latitude: null,
    longitude: null,
  });
  const router = useRouter();

  const extractSpotifyPlaylistId = (url: string): string | null => {
    // Regex to capture playlist ID from various Spotify URL formats
    // e.g., https://open.spotify.com/playlist/PLAYLIST_ID?si=...
    // or spotify:playlist:PLAYLIST_ID
    const regex =
      /^(?:spotify:playlist:|https:\/\/open\.spotify\.com\/playlist\/)([a-zA-Z0-9]+)/;
    const match = url.match(regex);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  };

  const fetchAndSetName = async (playlistId: string) => {
    setIsFetchingName(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/spotify/playlist-name/${playlistId}`,
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Could not fetch playlist name from Spotify.",
        );
      }
      const data = await response.json();
      if (data.name) {
        setName(data.name);
      } else {
        throw new Error("Playlist name not found in Spotify response.");
      }
    } catch (e: any) {
      console.error("Failed to fetch playlist name:", e);
      setError(
        `Failed to fetch playlist name: ${e.message}. Please enter manually.`,
      );
    } finally {
      setIsFetchingName(false);
    }
  };

  const handleUrlChange = (newUrl: string) => {
    setSpotifyPlaylistUrl(newUrl);
    setError(null);
    const extractedId = extractSpotifyPlaylistId(newUrl);
    if (extractedId) {
      fetchAndSetName(extractedId);
    } else {
      setName("");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const extractedId = extractSpotifyPlaylistId(spotifyPlaylistUrl);

    if (!extractedId) {
      setError(
        "Invalid Spotify Playlist URL. Please provide a valid URL like https://open.spotify.com/playlist/YOUR_PLAYLIST_ID or spotify:playlist:YOUR_PLAYLIST_ID",
      );
      return;
    }

    if (!name && !isFetchingName) {
      setError(
        "Playlist name could not be fetched. Please check the URL or try again.",
      );
      return;
    }

    if (isFetchingName) {
      setError("Still fetching playlist name, please wait.");
      return;
    }

    // if (!location.latitude || !location.longitude) {
    //   setError("Please select a location for your playlist.");
    //   return;
    // }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/playlists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          spotify_playlist_id: extractedId,
          description,
          // latitude: location.latitude || 0,
          // longitude: location.longitude || 0,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        );
      }
      setName("");
      setSpotifyPlaylistUrl("");
      setDescription("");
      setLocation({ latitude: null, longitude: null });
      router.refresh();
    } catch (e: any) {
      console.error("Failed to create playlist:", e);
      setError(`Failed to create playlist: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) {
    return <p className="text-center my-8">Loading form...</p>;
  }

  if (!user) {
    return (
      <section className="mb-8 p-6 bg-spotify-light-dark shadow-md rounded-lg text-center">
        <h2 className="text-2xl font-semibold mb-4">Add New Playlist</h2>
        <p className="text-spotify-light-gray">
          Please log in to add a new playlist.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8 p-6 bg-spotify-light-dark shadow-md rounded-lg">
      <h2 className="text-spotify-light-gray text-2xl font-semibold mb-4">
        Add New Playlist
      </h2>
      <MixtapeSticker />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="spotifyPlaylistUrl"
            className="block text-sm font-medium text-spotify-light-gray"
          >
            Spotify Playlist URL:
          </label>
          <input
            id="spotifyPlaylistUrl"
            type="text"
            value={spotifyPlaylistUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            required
            disabled={isSubmitting}
            className="mt-1 block w-full px-3 py-2 border border-spotify-gray rounded-md shadow-sm focus:outline-none focus:ring-spotify-green focus:border-spotify-green sm:text-sm disabled:bg-gray-50 text-spotify-light-gray p-4"
          />
        </div>
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-spotify-light-gray"
          >
            Description (Optional):
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={isSubmitting}
            className="mt-1 block w-full px-3 py-2 border border-spotify-gray rounded-md shadow-sm focus:outline-none focus:ring-spotify-green focus:border-spotify-green sm:text-sm disabled:bg-gray-50 text-spotify-light-gray p-4"
          />
        </div>

        {/* <div className="mt-6">
          <h3 className="text-lg font-medium text-spotify-light-gray mb-4">
            Location
          </h3>
          <LocationInput onLocationChange={setLocation} />
        </div> */}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium bg-spotify-green hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-spotify-green disabled:bg-indigo-300"
        >
          {isSubmitting ? "Submitting..." : "Add Playlist"}
        </button>
      </form>
      {error && <p className="mt-4 text-red-500 text-sm">Error: {error}</p>}
    </section>
  );
}
