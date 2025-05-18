'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { SpotifyRecorder, RecordingSegment } from '@repo/shared-ui';
import { useAuth } from '@repo/shared-contexts';
import { useSpotifyPlayer } from '@repo/shared-contexts';

export default function SpotifyRecorderControl() {
  const { user, accessToken, isLoading: isAuthLoading } = useAuth();
  const {
    player: contextPlayer,
    deviceId: contextDeviceId,
    isReady: isContextPlayerReady,
  } = useSpotifyPlayer();

  const [recorder, setRecorder] = useState<SpotifyRecorder | null>(null);
  const [isRecorderFeatureReady, setIsRecorderFeatureReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedData, setRecordedData] = useState<RecordingSegment[]>([]);
  const [componentError, setComponentError] = useState<string | null>(null);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [recordingName, setRecordingName] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleGetOAuthToken = useCallback((callback: (token: string) => void) => {
    if (accessToken) {
      callback(accessToken);
    } else {
      console.error('[SpotifyRecorderControl] Spotify OAuth accessToken not available for recorder.');
      setComponentError('Auth token missing. Please log in again.');
    }
  }, [accessToken]);

  useEffect(() => {
    if (user && accessToken && contextPlayer && contextDeviceId && isContextPlayerReady) {
      if (!recorder) {
        console.log('[SpotifyRecorderControl] Context player ready. Initializing SpotifyRecorder with this external player.');
        const recorderInstance = new SpotifyRecorder({
          getOAuthToken: handleGetOAuthToken,
          externalPlayer: contextPlayer,
          externalDeviceId: contextDeviceId,
          onAuthError: (err) => {
            console.error('[SpotifyRecorderControl] Recorder Auth Error (likely playback API call):', err);
            setComponentError(`Recorder Auth Error: ${err.message}`);
          },
          onPlayerError: (err) => {
            console.error('[SpotifyRecorderControl] Recorder Operation Error:', err);
            setComponentError(`Recorder Operation Error: ${err.message}`);
          },
        });
        setRecorder(recorderInstance);
        setIsRecorderFeatureReady(true);
        setComponentError(null); 
      } else {
        if (!isRecorderFeatureReady) setIsRecorderFeatureReady(true);
      }
    } else {
      if (recorder) {
        recorder.dispose();
        setRecorder(null);
      }
      setIsRecorderFeatureReady(false);
      if (!isAuthLoading && (!user || !accessToken)){
      } else if (isAuthLoading) {
      } else if (!isContextPlayerReady) {
      }
    }

    return () => {
      if (recorder) {
         console.log("[SpotifyRecorderControl] useEffect cleanup: Disposing recorder instance.");
         recorder.dispose();
      }
    };
  }, [user, accessToken, contextPlayer, contextDeviceId, isContextPlayerReady, handleGetOAuthToken, recorder]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlayingBack) {
        audioRef.current.play().catch(e => console.error("Error playing rewind sound:", e));
      } else {
        audioRef.current.pause();
        audioRef.current.currentTime = 0; // Reset for next play
      }
    }
  }, [isPlayingBack]);

  useEffect(() => {
    const audioElement = audioRef.current;
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = ''; // Release resource
      }
    };
  }, []);

  // Load recordings from local storage on component mount
  useEffect(() => {
    try {
      const savedRecordingsJson = localStorage.getItem('spotifyRecordings');
      if (savedRecordingsJson) {
        const savedRecordings = JSON.parse(savedRecordingsJson);
        if (Array.isArray(savedRecordings)) {
          setRecordedData(savedRecordings);
          console.log('[SpotifyRecorderControl] Loaded recordings from local storage.');
        }
      }
    } catch (e) {
      console.error('[SpotifyRecorderControl] Failed to load recordings from local storage:', e);
    }
  }, []);

  const handleStartRecording = async () => {
    if (!recorder || !isRecorderFeatureReady) {
      setComponentError('Recorder not ready. Spotify player may not be active or an error occurred.');
      return;
    }
    try {
      const success = await recorder.startRecording();
      if (success) {
        setIsRecording(true);
        setComponentError(null);
        setRecordedData([]);
      } else {
        setComponentError('Failed to start recording. Is a track playing on the selected Spotify device?');
      }
    } catch (err: unknown) {
      setComponentError(`Error starting recording: ${(err as Error).message}`);
    }
  };

  const handleStopRecording = () => {
    if (!recorder) return;
    recorder.stopRecording();
    setIsRecording(false);
    const data = recorder.getRecording();
    setRecordedData(data);
    console.log('[SpotifyRecorderControl] Recording stopped. Data:', data);
    // Save to local storage
    try {
      localStorage.setItem('spotifyRecordings', JSON.stringify(data));
      console.log('[SpotifyRecorderControl] Recording saved to local storage.');
    } catch (e) {
      console.error('[SpotifyRecorderControl] Failed to save recording to local storage:', e);
    }

    // Save to database via API
    if (data && data.length > 0) {
      saveRecordingToDb(data, recordingName);
    }
  };

  const saveRecordingToDb = async (segments: RecordingSegment[], name?: string) => {
    if (!user) {
      console.error('[SpotifyRecorderControl] User not available, cannot save recording to DB.');
      setComponentError('User not found. Cannot save recording.');
      return;
    }
    console.log('[SpotifyRecorderControl] Attempting to save recording to DB:', segments);
    try {
      const response = await fetch('/api/recordings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ segments: segments, userId: user.id, name: name }), // Send segments, userId, and name
        credentials: 'include', // Important for sending session cookies
      });

      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ message: 'Failed to save recording. Server error.' }));
        console.error('[SpotifyRecorderControl] Error saving recording to DB:', errorResult);
        setComponentError(errorResult.message || 'Failed to save recording.');
        return;
      }

      const result = await response.json();
      console.log('[SpotifyRecorderControl] Recording saved to DB successfully:', result);
      // Optionally, provide user feedback about successful save
      // e.g., setComponentError('Recording saved successfully!'); (use a different state for success messages)
    } catch (error) {
      console.error('[SpotifyRecorderControl] Network or unexpected error saving recording to DB:', error);
      setComponentError('Network error. Failed to save recording.');
    }
  };

  const handlePlayRecording = async () => {
    if (!recorder || !isRecorderFeatureReady) {
      setComponentError('Recorder not ready for playback.');
      return;
    }
    const currentDataToPlay = recordedData.length > 0 ? recordedData : recorder.getRecording();
    if (currentDataToPlay.length === 0) {
        setComponentError('No recording available to play.');
        return;
    }
    if (recordedData.length === 0 && currentDataToPlay.length > 0) {
      setRecordedData(currentDataToPlay);
    }

    try {
      setIsPlaying(true);
      setComponentError(null);
      const success = await recorder.playRecording(currentDataToPlay);
      if (success) {
        setIsPlayingBack(true);
      } else {
        setIsPlaying(false);
        setIsPlayingBack(false);
        setComponentError('Failed to start playback. Check console for recorder errors.');
      }
    } catch (err: unknown) {
      setIsPlaying(false);
      setIsPlayingBack(false);
      setComponentError(`Error playing recording: ${(err as Error).message}`);
    }
  };

  const handleStopPlayback = () => {
    if(!recorder) return;
    recorder.stopPlaybackOfRecording(true);
    setIsPlaying(false);
    setIsPlayingBack(false);
    console.log("[SpotifyRecorderControl] Playback stopped by user.");
  }

  if (isAuthLoading) {
    return <p className="text-center p-4 text-gray-400">Loading authentication...</p>;
  }

  if (!user || !accessToken) {
    return <p className="text-center p-4 text-yellow-300">Please log in to use the Spotify Recorder.</p>;
  }
  
  let statusMessageElement = null;
  if (typeof window !== 'undefined' && !window.Spotify && !isContextPlayerReady) {
    statusMessageElement = <p className="text-yellow-400">Spotify SDK main script loading...</p>;
  } else if (!isContextPlayerReady && accessToken) {
    statusMessageElement = <p className="text-yellow-400">Spotify Player (Mixtape In A Bottle Web Player) initializing... <br/>Ensure Spotify app is open, you are Premium, and select it from Spotify&apos;s device list.</p>;
  } else if (isContextPlayerReady && !isRecorderFeatureReady) {
    statusMessageElement = <p className="text-blue-400">Player active. Recorder features initializing...</p>;
  }

  return (
    <div className="p-4 border border-gray-700 rounded-lg shadow-lg space-y-4 bg-gray-800 text-white">
      <h2 className="text-xl font-semibold mb-3">Spotify Recorder</h2>
      
      {componentError && <p className="p-2 my-2 bg-red-500 text-white rounded shadow">Error: {componentError}</p>}
      {statusMessageElement}
      
      {isContextPlayerReady && contextDeviceId &&
        <p className="text-sm text-green-400 mb-3">
          Player Active (Device: {contextDeviceId.substring(0,10)}...) {isRecorderFeatureReady ? "- Recorder Ready" : <span className="text-yellow-400">- Recorder Initializing...</span>}
        </p>
      }
      
      {!isRecording && !isPlaying && (
         <div className="my-2">
          <label htmlFor="recordingName" className="block text-sm font-medium text-gray-300 mb-1">Recording Name (Optional):</label>
          <input 
            type="text"
            id="recordingName"
            value={recordingName}
            onChange={(e) => setRecordingName(e.target.value)}
            placeholder={`My Awesome Mix - ${new Date().toLocaleDateString()}`}
            className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:ring-sky-500 focus:border-sky-500 text-white shadow-sm"
          />
        </div>
      )}
      
      <div className="flex flex-wrap gap-2">
        <button 
          onClick={handleStartRecording} 
          disabled={!isRecorderFeatureReady || isRecording || isPlaying}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors shadow-md"
        >
          Record
        </button>
        <button 
          onClick={handleStopRecording} 
          disabled={!isRecording}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors shadow-md"
        >
          Stop Recording
        </button>
        <button 
          onClick={handlePlayRecording} 
          disabled={!isRecorderFeatureReady || isRecording || isPlaying || recordedData.length === 0}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors shadow-md"
        >
          Play Recording
        </button>
        <button 
          onClick={handleStopPlayback} 
          disabled={!isPlaying}
          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors shadow-md"
        >
          Stop Playback
        </button>
      </div>
      
      {recordedData.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg">Recorded Segments ({recordedData.length}):</h3>
          <ul className="list-disc pl-5 space-y-2 max-h-60 overflow-y-auto p-2 bg-gray-900 rounded border border-gray-700 shadow-inner">
            {recordedData.map((segment, index) => (
              <li key={index} className="p-2 border-b border-gray-800 last:border-b-0">
                <strong className="text-sky-400">Segment {index + 1}: {segment.type}</strong>
                <div className="pl-3 text-sm text-gray-300">
                  <p>Duration: {(segment.durationMs / 1000).toFixed(2)}s</p>
                  <p>Session Start: {(segment.sessionStartMs / 1000).toFixed(2)}s</p>
                  {segment.type === 'track' && segment.trackId && (
                    <>
                      <p>Track ID: <span className="text-green-400">{segment.trackId}</span></p>
                      <p>Track Start Offset: {(segment.trackStartMs ?? 0 / 1000).toFixed(2)}s</p>
                      <p>Track End Offset: {(segment.trackEndMs ?? 0 / 1000).toFixed(2)}s</p>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hidden Audio Element for Rewind Sound */}
      <audio ref={audioRef} src="/cassette-tape-rewind.wav" loop preload="auto" />
    </div>
  );
} 