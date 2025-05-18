'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@repo/shared-contexts'; // Assuming this provides user info

interface RecordingSegment {
  id: number;
  recording_id: number;
  type: 'track' | 'silence';
  session_start_ms: number;
  duration_ms: number;
  track_id?: string;
  track_start_ms?: number;
  track_end_ms?: number;
  created_at: string;
}

interface Recording {
  id: number;
  user_id: string; // or number, depending on your user ID type in DB
  name?: string;
  created_at: string;
  updated_at: string;
  segments?: RecordingSegment[]; // Optional: if you decide to fetch segments along with recordings
  segmentCount?: number; // Add this if you fetch it
}

export default function SavedRecordingsList() {
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecordings = async () => {
      if (!user) {
        setIsLoading(false);
        // setError("Please log in to view saved recordings."); // Or just show nothing
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/recordings', {
          credentials: 'include',
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ message: 'Failed to fetch recordings' }));
          throw new Error(errData.message || `Error: ${response.status}`);
        }
        const data: Recording[] = await response.json();
        setRecordings(data);
      } catch (err: unknown) {
        console.error("Error fetching recordings:", err);
        setError((err instanceof Error) ? err.message : 'Could not fetch recordings.');
      }
      setIsLoading(false);
    };

    fetchRecordings();
  }, [user]); // Refetch if user changes

  if (isLoading) {
    return <p className="text-center p-4 text-gray-400">Loading saved recordings...</p>;
  }

  if (error) {
    return <p className="text-center p-4 text-red-500">Error: {error}</p>;
  }

  if (!user) {
    return <p className="text-center p-4 text-yellow-300">Please log in to see your saved recordings.</p>;
  }

  if (recordings.length === 0) {
    return <p className="text-center p-4 text-gray-500">No saved recordings found.</p>;
  }

  return (
    <div className="p-4 border border-gray-700 rounded-lg shadow-lg space-y-4 bg-gray-800 text-white mt-6">
      <h2 className="text-xl font-semibold mb-3">Your Saved Recordings</h2>
      <ul className="space-y-3">
        {recordings.map((recording) => (
          <li key={recording.id} className="p-3 bg-gray-700 rounded-md shadow hover:bg-gray-600 transition-colors">
            <h3 className="text-lg font-medium text-sky-400">{recording.name || `Recording ID: ${recording.id}`}</h3>
            <p className="text-sm text-gray-300">Saved on: {new Date(recording.created_at).toLocaleString()}</p>
            {/* 
              Placeholder for more details or actions:
              <p>Segments: {recording.segmentCount || 'N/A'}</p> 
              <button className="text-xs text-blue-400 hover:underline">View Segments</button>
              <button className="text-xs text-red-400 hover:underline ml-2">Delete</button> 
            */}
          </li>
        ))}
      </ul>
    </div>
  );
} 