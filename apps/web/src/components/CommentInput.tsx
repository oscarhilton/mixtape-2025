'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@repo/shared-contexts';
import { useSpotifyPlayer } from '@repo/shared-contexts';
import { useRouter } from 'next/navigation';
import { Button } from "@repo/shared-ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CommentInputProps {
  playlistId: number | null; // The ID of the current playlist
}

export function CommentInput({ playlistId }: CommentInputProps) {
  const { user } = useAuth();
  const { currentTrack, position } = useSpotifyPlayer();
  const router = useRouter();
  
  const positionRef = useRef(position); // Ref to hold the latest position

  const [commentText, setCommentText] = useState('');
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
      setError('You must be logged in to comment.');
      return;
    }
    if (!playlistId) {
      setError('No active playlist selected to comment on.');
      return;
    }
    if (!currentTrack || !currentTrack.uri) {
      setError('No track is currently playing or track URI is missing.');
      return;
    }
    if (currentPosition === null) { 
      setError('Could not determine current track timestamp. Position is null.');
      return;
    }
    console.log('[CommentInput] Current position from ref before submit:', currentPosition);

    if (!commentText.trim()) {
      setError('Comment cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('[CommentInput] Submitting comment with timestamp_ms:', currentPosition); 
      const response = await fetch(`${API_URL}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playlist_id: playlistId,
          track_uri: currentTrack.uri,
          timestamp_ms: currentPosition, // Use position from ref
          comment_text: commentText.trim(),
        }),
        credentials: 'include',
      });

      if (response.ok) {
        setSuccessMessage('Comment added successfully!');
        setCommentText('');
        router.refresh();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to add comment.');
        console.error('Failed to add comment:', errorData);
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
      setError('An unexpected error occurred.');
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
    <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h4>Add Comment at {displayPosition !== null ? `${Math.floor(displayPosition / 1000)}s` : 'current time'} for "{currentTrack.name}"</h4>
      <form onSubmit={handleSubmitComment}>
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write your comment..."
          rows={3}
          style={{ width: '100%', marginBottom: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          disabled={isSubmitting || !playlistId}
        />
        <button 
          type="submit" 
          disabled={isSubmitting || !playlistId || !commentText.trim() || positionRef.current === null} // Check ref for disabling
          style={{ padding: '10px 15px', borderRadius: '4px', background: '#1DB954', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          {isSubmitting ? 'Adding...' : 'Add Comment'}
        </button>
        {error && <p style={{ color: 'red', marginTop: '10px' }}>Error: {error}</p>}
        {successMessage && <p style={{ color: 'green', marginTop: '10px' }}>{successMessage}</p>}
      </form>
    </div>
  );
} 