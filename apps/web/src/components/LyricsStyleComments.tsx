'use client';

import React, { useEffect, useState } from 'react';
import Typewriter from 'typewriter-effect';
import { useSpotifyPlayer } from '@repo/shared-contexts';

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

interface LyricsStyleCommentsProps {
  comments: Comment[];
  currentTrackUri?: string;
}

export function LyricsStyleComments({ comments, currentTrackUri }: LyricsStyleCommentsProps) {
  const { position } = useSpotifyPlayer();
  const [activeComment, setActiveComment] = useState<Comment | null>(null);
  const [showTypewriter, setShowTypewriter] = useState(false);

  useEffect(() => {
    if (!position || !currentTrackUri) {
      setActiveComment(null);
      return;
    }

    // Filter comments for current track and find the most recent one before current position
    const trackComments = comments
      .filter(comment => comment.track_uri === currentTrackUri)
      .sort((a, b) => a.timestamp_ms - b.timestamp_ms);

    const currentComment = trackComments.reduce((prev, curr) => {
      if (curr.timestamp_ms <= position && (!prev || curr.timestamp_ms > prev.timestamp_ms)) {
        return curr;
      }
      return prev;
    }, null as Comment | null);

    if (currentComment !== activeComment) {
      setShowTypewriter(false);
      setTimeout(() => {
        setActiveComment(currentComment);
        setShowTypewriter(true);
      }, 300);
    }
  }, [position, comments, currentTrackUri, activeComment]);

  if (!currentTrackUri || !activeComment) {
    return (
      <div className="min-h-[200px] flex items-center justify-center text-spotify-light-gray">
        <p>No comments to display for this track</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[200px] bg-gradient-to-b from-spotify-light-dark to-spotify-dark p-6 rounded-lg">
      <div className="absolute inset-0 bg-gradient-to-t from-spotify-dark/80 to-transparent pointer-events-none" />
      
      <div className="relative z-10">
        <div className="mb-4">
          <p className="text-spotify-light-gray text-sm">
            {new Date(activeComment.timestamp_ms).toISOString().substr(14, 5)}
          </p>
        </div>
        
        <div className="text-2xl font-bold text-white leading-relaxed">
          {showTypewriter ? (
            <Typewriter
              options={{
                strings: [activeComment.comment_text],
                autoStart: true,
                delay: 30,
                deleteSpeed: 9999999, // Effectively disable deletion
                cursor: '_',
                loop: false,
              }}
            />
          ) : (
            <div className="h-8" /> // Placeholder height while transitioning
          )}
        </div>
      </div>
    </div>
  );
} 