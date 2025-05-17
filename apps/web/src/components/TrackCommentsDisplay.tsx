"use client";

import React, { useState, useEffect } from "react";
import { useSpotifyPlayer } from "@repo/shared-contexts";

// Mirror the Comment interface from page.tsx (or import if shareable)
interface Comment {
  id: number;
  playlist_id: number;
  user_id: number; // Consider fetching/showing username later
  track_uri: string;
  timestamp_ms: number;
  comment_text: string;
  created_at: string;
  updated_at: string;
}

interface TrackCommentsDisplayProps {
  playlistId: number;
  comments: Comment[];
}

const COMMENT_DISPLAY_WINDOW_MS = 3000; // Show comment if current time is within +/- 3s of comment timestamp

export function TrackCommentsDisplay({
  playlistId,
  comments,
}: TrackCommentsDisplayProps) {
  const { currentTrack, position } = useSpotifyPlayer();
  const [activeComments, setActiveComments] = useState<Comment[]>([]);

  useEffect(() => {
    if (!currentTrack || position === null) {
      // Clear active comments if no track or position
      if (activeComments.length > 0) setActiveComments([]);
      return;
    }

    const commentsForCurrentTrack = comments.filter(
      (comment) =>
        comment.track_uri === currentTrack.uri &&
        comment.playlist_id === playlistId,
    );

    const nowActive = commentsForCurrentTrack.filter((comment) => {
      const timeDifference = Math.abs(comment.timestamp_ms - position);
      return timeDifference < COMMENT_DISPLAY_WINDOW_MS / 2;
    });

    // Only update if the actual content of active comments changes
    // This stringify comparison is a bit basic but can prevent some unnecessary re-renders.
    // For more complex objects or performance-critical sections, consider a more robust deep-compare library or optimizing the condition.
    if (JSON.stringify(activeComments) !== JSON.stringify(nowActive)) {
      setActiveComments(nowActive);
    }
  }, [currentTrack, position, comments, playlistId]); // Removed activeComments from dependency array

  if (!activeComments.length) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0, 0, 0, 0.7)",
        color: "white",
        padding: "10px 20px",
        borderRadius: "8px",
        zIndex: 1000,
        maxWidth: "80%",
        textAlign: "center",
      }}
    >
      {activeComments.map((comment) => (
        <div key={comment.id}>
          <p>
            <strong>User {comment.user_id} says:</strong> {comment.comment_text}
          </p>
          <small>(at {Math.floor(comment.timestamp_ms / 1000)}s)</small>
        </div>
      ))}
    </div>
  );
}
