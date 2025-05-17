"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@repo/shared-contexts"; // Updated import

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface VoteButtonProps {
  playlistId: number;
  initialVotes: number;
}

export default function VoteButton({
  playlistId,
  initialVotes,
}: VoteButtonProps) {
  const [votes, setVotes] = useState(initialVotes);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth(); // Get user session

  // Update votes if initialVotes prop changes (e.g. after parent re-fetches)
  useEffect(() => {
    setVotes(initialVotes);
  }, [initialVotes]);

  const handleVote = async () => {
    if (!user) {
      setError("Please log in to vote.");
      // Optionally, redirect to login or show a login modal
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/playlists/${playlistId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Include auth token if your API requires it for voting
          // 'Authorization': `Bearer ${your_auth_token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit vote");
      }
      const updatedPlaylist = await response.json();
      setVotes(updatedPlaylist.votes);
    } catch (e: any) {
      console.error("Vote submission error:", e);
      setError(e.message || "Could not submit vote.");
      // Optionally revert optimistic update if you implement one
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-3 flex items-center space-x-2">
      <button
        onClick={handleVote}
        disabled={isLoading || !user} // Disable if loading or not logged in
        className="text-spotify-light-gray px-4 py-1 bg-blue-500 rounded hover:bg-blue-600 disabled:bg-gray-300 transition-colors text-sm"
      >
        {isLoading ? "Voting..." : "Vote"}
      </button>
      <span className="text-sm text-spotify-light-gray">Votes: {votes}</span>
      {error && <p className="ml-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
