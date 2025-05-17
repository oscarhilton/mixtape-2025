"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@repo/shared-contexts";
import { useSpotifyPlayer } from "@repo/shared-contexts";
import { useRouter } from "next/navigation";
import { logger } from "@repo/shared-ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface CommentInputProps {
  playlistId: number | null; // The ID of the current playlist
}

export function CommentInput({ playlistId }: CommentInputProps) {
  const { user } = useAuth();
  const { currentTrack, position } = useSpotifyPlayer();
  const router = useRouter();

  const positionRef = useRef(position); // Ref to hold the latest position

  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    positionRef.current = position; // Keep the ref updated with the latest position
  }, [position]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const currentPosition = positionRef.current; // Use the latest position from the ref

    if (!user) {
      setError("You must be logged in to comment.");
      return;
    }
    if (!playlistId) {
      setError("No active playlist selected to comment on.");
      return;
    }
    if (!currentTrack || !currentTrack.uri) {
      setError("No track is currently playing or track URI is missing.");
      return;
    }
    if (currentPosition === null) {
      setError(
        "Could not determine current track timestamp. Position is null.",
      );
      return;
    }
    logger.log(
      "[CommentInput] Current position from ref before submit:",
      currentPosition,
    );

    if (!commentText.trim()) {
      setError("Comment cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    try {
      console.log(
        "[CommentInput] Submitting comment with timestamp_ms:",
        currentPosition,
      );
      const response = await fetch(`${API_URL}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playlist_id: playlistId,
          track_uri: currentTrack.uri,
          timestamp_ms: currentPosition, // Use position from ref
          comment_text: commentText.trim(),
        }),
        credentials: "include",
      });

      if (response.ok) {
        setSuccessMessage("Comment added successfully!");
        setCommentText("");
        router.refresh();
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Failed to add comment.");
        console.error("Failed to add comment:", errorData);
      }
    } catch (err) {
      console.error("Error submitting comment:", err);
      setError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000);
    }
  };

  // Display still uses the reactive `position` for immediate UI updates
  const displayPosition = position;

  if (!user || !currentTrack) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-spotify-light-gray text-sm font-medium">
          Add comment at{" "}
          {displayPosition !== null
            ? `${Math.floor(displayPosition / 1000)}s`
            : "current time"}
        </h4>
        <p className="text-spotify-light-gray text-sm">{currentTrack.name}</p>
      </div>

      <form onSubmit={handleSubmitComment} className="space-y-4">
        <div className="relative">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write your comment..."
            rows={3}
            className={`w-full bg-spotify-dark border rounded-md p-3 placeholder-spotify-light-gray
              focus:outline-none focus:ring-2 focus:ring-spotify-green
              ${isSubmitting || !playlistId ? "opacity-50 cursor-not-allowed" : ""}
              ${error ? "border-red-500" : "border-spotify-gray"}`}
            disabled={isSubmitting || !playlistId}
          />
          {error && (
            <p className="absolute -bottom-6 left-0 text-red-500 text-sm">
              {error}
            </p>
          )}
          {successMessage && (
            <p className="absolute -bottom-6 left-0 text-spotify-green text-sm">
              {successMessage}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !playlistId ||
              !commentText.trim() ||
              positionRef.current === null
            }
            className={`px-6 py-2 rounded-full font-medium transition-all
              ${
                isSubmitting ||
                !playlistId ||
                !commentText.trim() ||
                positionRef.current === null
                  ? "bg-spotify-gray text-spotify-light-gray cursor-not-allowed"
                  : "bg-spotify-green text-black hover:scale-105"
              }`}
          >
            {isSubmitting ? "Adding..." : "Add Comment"}
          </button>
        </div>
      </form>
    </div>
  );
}
