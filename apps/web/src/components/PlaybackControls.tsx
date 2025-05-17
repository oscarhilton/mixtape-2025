"use client";

import { useSpotifyPlayer } from "@repo/shared-contexts";
import { CommentInput } from "./CommentInput";
import React from "react";
import {
  PlayIcon,
  PauseIcon,
  ForwardIcon, // Placeholder for Next Track
  BackwardIcon, // Placeholder for Previous Track
} from "@heroicons/react/24/solid"; // Example using Heroicons
import Image from "next/image";
interface PlaybackControlsProps {
  currentPlaylistId: number | null;
}

export function PlaybackControls({ currentPlaylistId }: PlaybackControlsProps) {
  const {
    player, // Direct access to player for nextTrack, prevTrack, seek, setVolume
    isReady: playerIsReady,
    currentTrack,
    isPaused,
    pause, // SDK pause
    resume, // SDK resume
    position,
    duration,
  } = useSpotifyPlayer();

  const handleTogglePlayback = () => {
    if (currentTrack) {
      if (isPaused) {
        resume();
      } else {
        pause();
      }
    }
  };

  const handleNextTrack = () => {
    if (player)
      player
        .nextTrack()
        .catch((err) => console.error("Error skipping to next track:", err));
  };

  const handlePreviousTrack = () => {
    if (player)
      player
        .previousTrack()
        .catch((err) =>
          console.error("Error skipping to previous track:", err),
        );
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newPosition = parseInt(event.target.value, 10);
    if (player && !isNaN(newPosition)) {
      player
        .seek(newPosition)
        .catch((err) => console.error("Error seeking track:", err));
    }
  };

  const formatTime = (ms: number | null) => {
    if (ms === null) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!playerIsReady) {
    // Simplified check, deviceId might not be immediately available but playerIsReady is key
    return (
      <div className="text-center p-4">
        <p>Connecting to Spotify Player...</p>
        <p className="text-xs">
          Ensure Spotify is open and you&apos;re logged in with a Premium
          account.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-spotify-light-dark dark:bg-spotify-dark rounded-lg">
      {currentTrack && (
        <div className="flex items-center space-x-3 mb-3">
          {currentTrack.album.images[0]?.url && (
            <Image
              src={currentTrack.album.images[0].url}
              alt={currentTrack.album.name}
              className="w-14 h-14 rounded-md shadow-lg"
              width={56}
              height={56}
            />
          )}
          <div>
            <p className="text-spotify-light-gray font-semibold text-base truncate">
              {currentTrack.name}
            </p>
            <p className="text-sm text-spotify-light-gray truncate">
              {currentTrack.artists.map((artist) => artist.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {currentTrack && duration !== null && position !== null && (
        <div className="space-y-1">
          <input
            type="range"
            min="0"
            max={duration}
            value={position}
            onChange={handleSeek}
            className="w-full h-1 bg-spotify-gray rounded-lg appearance-none cursor-pointer accent-spotify-green"
            // Note: Styling range inputs can be tricky and might need more specific CSS or a library for full cross-browser consistency
            // The 'accent-spotify-green' class will style the thumb and progress on some browsers.
          />
          <div className="text-spotify-light-gray flex justify-between text-xs">
            <span>{formatTime(position)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* Playback Buttons */}
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={handlePreviousTrack}
          title="Previous Track"
          className="text-spotify-light-gray hover transition-colors"
        >
          <BackwardIcon className="w-6 h-6" />
        </button>
        <button
          onClick={handleTogglePlayback}
          title={currentTrack && !isPaused ? "Pause" : "Play"}
          className="p-2 bg-white text-black dark:text-white rounded-full hover:scale-105 transition-transform"
        >
          {currentTrack && !isPaused ? (
            <PauseIcon className="w-7 h-7" />
          ) : (
            <PlayIcon className="w-7 h-7" />
          )}
        </button>
        <button
          onClick={handleNextTrack}
          title="Next Track"
          className="text-spotify-light-gray hover transition-colors"
        >
          <ForwardIcon className="w-6 h-6" />
        </button>
        {/* Volume control could be added here later */}
      </div>
    </div>
  );
}
