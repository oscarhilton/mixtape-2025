'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { SpotifyRecorder, RecordingSegment } from '@repo/shared-ui';
import { useAuth } from '@repo/shared-contexts';
import { useSpotifyPlayer } from '@repo/shared-contexts';
import CassetteTape from './CassetteTape';

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
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentSegmentId, setCurrentSegmentId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackStartTimeRef = useRef<number | null>(null);
  const isUpdatingRef = useRef(false);

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
    }

    return () => {
      if (recorder) {
         console.log("[SpotifyRecorderControl] useEffect cleanup: Disposing recorder instance.");
         recorder.dispose();
      }
    };
  }, [user, accessToken, contextPlayer, contextDeviceId, isContextPlayerReady, handleGetOAuthToken, recorder]);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio('/sounds/rewind.mp3'); // Make sure this file exists in your public directory
      audio.preload = 'auto';
      audio.load();
      audioRef.current = audio;
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlayingBack) {
        // Reset the audio element before playing
        audioRef.current.currentTime = 0;
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Error playing rewind sound:", error);
            // If autoplay is blocked, we can try to play on user interaction
            if (error.name === 'NotAllowedError') {
              console.log("Autoplay blocked. Will play on next user interaction.");
            }
          });
        }
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

  // Calculate total duration of all segments
  useEffect(() => {
    if (recordedData.length > 0) {
      const total = recordedData.reduce((sum, segment) => sum + segment.durationMs, 0);
      setTotalDuration(total);
    }
  }, [recordedData]);

  const findSegmentAtTime = (elapsedMs: number) => {
    const segment = recordedData.find(segment => 
      elapsedMs >= segment.sessionStartMs && 
      elapsedMs < (segment.sessionStartMs + segment.durationMs)
    );
    console.log(`[Debug] Finding segment at ${elapsedMs}ms:`, segment ? {
      type: segment.type,
      trackId: segment.trackId,
      sessionStart: segment.sessionStartMs,
      duration: segment.durationMs,
      expectedStart: segment.sessionStartMs / 1000,
      expectedEnd: (segment.sessionStartMs + segment.durationMs) / 1000
    } : 'No segment found');
    return segment;
  };

  const calculateSegmentPosition = (elapsedMs: number, segment: RecordingSegment) => {
    const position = elapsedMs - segment.sessionStartMs;
    console.log(`[Debug] Calculating position for segment:`, {
      elapsedMs,
      sessionStart: segment.sessionStartMs,
      calculatedPosition: position,
      segmentType: segment.type,
      trackId: segment.trackId,
      timeInSegment: position / 1000,
      totalSegmentDuration: segment.durationMs / 1000
    });
    return position;
  };

  const handleTrackTransition = async (segment: RecordingSegment) => {
    console.log(`[Debug] Checking track transition:`, {
      segmentType: segment.type,
      trackId: segment.trackId,
      currentSegmentId,
      shouldTransition: segment.type === 'track' && 
        segment.trackId && 
        currentSegmentId !== segment.trackId,
      segmentStart: segment.sessionStartMs / 1000,
      segmentDuration: segment.durationMs / 1000
    });

    if (segment.type === 'track' && 
        segment.trackId && 
        currentSegmentId !== segment.trackId) {
      console.log(`[Debug] Transitioning to new track:`, {
        from: currentSegmentId,
        to: segment.trackId,
        atTime: elapsedTime / 1000,
        expectedStart: segment.sessionStartMs / 1000
      });
      setCurrentSegmentId(segment.trackId);
      await recorder?.playRecording([segment]);
    }
  };

  // Track elapsed time during playback
  useEffect(() => {
    let elapsedInterval: NodeJS.Timeout;
    
    console.log('[Debug] Playback tracking effect:', {
      isPlayingBack,
      currentPosition,
      totalDuration,
      hasRecorder: !!recorder,
      isUpdating: isUpdatingRef.current
    });
    
    if (isPlayingBack) {
      console.log(`[Debug] Starting playback tracking:`, {
        currentPosition,
        startTime: performance.now(),
        totalSegments: recordedData.length,
        totalDuration: totalDuration / 1000
      });
      
      // Initialize playback start time using currentPosition
      playbackStartTimeRef.current = performance.now() - currentPosition;
      
      elapsedInterval = setInterval(() => {
        if (!playbackStartTimeRef.current) {
          console.log('[Debug] No playback start time reference');
          return;
        }

        // Prevent concurrent updates
        if (isUpdatingRef.current) {
          console.log('[Debug] Skipping update - already updating');
          return;
        }

        isUpdatingRef.current = true;
        try {
          const newElapsed = Math.floor(performance.now() - playbackStartTimeRef.current);
          console.log(`[Debug] Playback update:`, {
            elapsed: newElapsed,
            totalDuration,
            isEnd: newElapsed >= totalDuration,
            timeInSeconds: newElapsed / 1000,
            isPlayingBack,
            hasRecorder: !!recorder
          });
          
          // Check if we've reached the end
          if (newElapsed >= totalDuration) {
            console.log('[Debug] Reached end of recording, stopping playback');
            handleStopPlayback();
            return;
          }

          // Find and handle current segment
          const currentSegment = findSegmentAtTime(newElapsed);
          if (currentSegment) {
            const segmentPosition = calculateSegmentPosition(newElapsed, currentSegment);
            console.log(`[Debug] Updating position:`, {
              segmentPosition,
              currentPosition,
              elapsed: newElapsed,
              timeInSeconds: newElapsed / 1000,
              segmentType: currentSegment.type,
              trackId: currentSegment.trackId,
              isPlayingBack,
              hasRecorder: !!recorder
            });
            
            // Update both elapsed time and current position atomically
            setElapsedTime(newElapsed);
            setCurrentPosition(segmentPosition);
            
            // Only trigger track transition if we're actually changing tracks
            if (currentSegment.type === 'track' && 
                currentSegment.trackId && 
                currentSegmentId !== currentSegment.trackId) {
              handleTrackTransition(currentSegment);
            }
          }
        } finally {
          isUpdatingRef.current = false;
        }
      }, 100);
    } else {
      console.log('[Debug] Stopping playback tracking:', {
        isPlayingBack,
        currentPosition,
        elapsedTime,
        hasRecorder: !!recorder
      });
      // Reset state when playback stops
      playbackStartTimeRef.current = null;
      setElapsedTime(0);
      setCurrentPosition(0);
      setCurrentSegmentId(null);
    }

    return () => {
      if (elapsedInterval) {
        console.log('[Debug] Cleaning up playback interval:', {
          isPlayingBack,
          currentPosition,
          elapsedTime,
          hasRecorder: !!recorder
        });
        clearInterval(elapsedInterval);
      }
    };
  }, [isPlayingBack, recordedData, totalDuration]);

  // Remove the separate position tracking effect since it's now handled in the main playback tracking
  useEffect(() => {
    if (isPlayingBack && recorder) {
      const currentSegment = recorder.getCurrentPlaybackSegment();
      if (!currentSegment) return;

      // Handle looping if enabled
      if (isLooping && loopStart !== null && loopEnd !== null) {
        const position = recorder.getCurrentPosition();
        if (position >= loopEnd) {
          recorder.seekTo(loopStart);
        }
      }
    }
  }, [isPlayingBack, recorder, isLooping, loopStart, loopEnd]);

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
      setSaveError('User not found. Cannot save recording.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    
    console.log('[SpotifyRecorderControl] Attempting to save recording to DB:', segments);
    try {
      const response = await fetch('/api/recordings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          segments: segments, 
          name: name || `Recording ${new Date().toLocaleString()}` 
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ message: 'Failed to save recording. Server error.' }));
        console.error('[SpotifyRecorderControl] Error saving recording to DB:', errorResult);
        setSaveError(errorResult.message || 'Failed to save recording.');
        return;
      }

      const result = await response.json();
      console.log('[SpotifyRecorderControl] Recording saved to DB successfully:', result);
      setSaveSuccess(true);
      // Clear the recording name after successful save
      setRecordingName('');
    } catch (error) {
      console.error('[SpotifyRecorderControl] Network or unexpected error saving recording to DB:', error);
      setSaveError('Network error. Failed to save recording.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRecording = () => {
    if (recordedData.length === 0) {
      setSaveError('No recording data to save.');
      return;
    }
    saveRecordingToDb(recordedData, recordingName);
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
      console.log('[Debug] Starting playback:', {
        isPlaying: true,
        isPlayingBack: false,
        segments: currentDataToPlay.length
      });
      setIsPlaying(true);
      setComponentError(null);
      const success = await recorder.playRecording(currentDataToPlay);
      if (success) {
        console.log('[Debug] Playback started successfully, setting isPlayingBack to true');
        setIsPlayingBack(true);
      } else {
        console.log('[Debug] Playback failed to start');
        setIsPlaying(false);
        setIsPlayingBack(false);
        setComponentError('Failed to start playback. Check console for recorder errors.');
      }
    } catch (err: unknown) {
      console.error('[Debug] Playback error:', err);
      setIsPlaying(false);
      setIsPlayingBack(false);
      setComponentError(`Error playing recording: ${(err as Error).message}`);
    }
  };

  const handleStopPlayback = () => {
    if(!recorder) return;
    console.log('[Debug] Stopping playback:', {
      isPlaying,
      isPlayingBack,
      currentPosition,
      elapsedTime
    });
    recorder.stopPlaybackOfRecording(true);
    setIsPlaying(false);
    setIsPlayingBack(false);
    console.log("[SpotifyRecorderControl] Playback stopped by user.");
  }

  const handleFastForward = async () => {
    if (!recorder || !isPlayingBack) {
      console.log('[Debug] Fast forward blocked:', { recorder: !!recorder, isPlayingBack });
      return;
    }
    
    const newElapsed = Math.min(elapsedTime + 5000, totalDuration);
    console.log(`[Debug] Fast forwarding:`, {
      from: elapsedTime,
      to: newElapsed,
      totalDuration
    });

    // Update playback start time to maintain correct position
    if (playbackStartTimeRef.current) {
      playbackStartTimeRef.current = performance.now() - newElapsed;
    }
    
    const targetSegment = findSegmentAtTime(newElapsed);
    if (targetSegment) {
      const segmentPosition = calculateSegmentPosition(newElapsed, targetSegment);
      
      // Update both elapsed time and current position atomically
      setElapsedTime(newElapsed);
      setCurrentPosition(segmentPosition);
      
      // Only trigger track transition if we're actually changing tracks
      if (targetSegment.type === 'track' && 
          targetSegment.trackId && 
          currentSegmentId !== targetSegment.trackId) {
        await handleTrackTransition(targetSegment);
      }
    }
  };

  const handleRewind = async () => {
    if (!recorder || !isPlayingBack) {
      console.log('[Debug] Rewind blocked:', { recorder: !!recorder, isPlayingBack });
      return;
    }
    
    const newElapsed = Math.max(elapsedTime - 5000, 0);
    console.log(`[Debug] Rewinding:`, {
      from: elapsedTime,
      to: newElapsed
    });

    // Update playback start time to maintain correct position
    if (playbackStartTimeRef.current) {
      playbackStartTimeRef.current = performance.now() - newElapsed;
    }
    
    const targetSegment = findSegmentAtTime(newElapsed);
    if (targetSegment) {
      const segmentPosition = calculateSegmentPosition(newElapsed, targetSegment);
      
      // Update both elapsed time and current position atomically
      setElapsedTime(newElapsed);
      setCurrentPosition(segmentPosition);
      
      // Only trigger track transition if we're actually changing tracks
      if (targetSegment.type === 'track' && 
          targetSegment.trackId && 
          currentSegmentId !== targetSegment.trackId) {
        await handleTrackTransition(targetSegment);
      }
    }
  };

  const handleSetLoopStart = () => {
    setLoopStart(currentPosition);
    if (loopEnd !== null && currentPosition >= loopEnd) {
      setLoopEnd(null); // Reset end if start is after current end
    }
  };

  const handleSetLoopEnd = () => {
    if (loopStart === null || currentPosition <= loopStart) {
      setLoopStart(null); // Reset start if end is before current start
    }
    setLoopEnd(currentPosition);
  };

  const handleToggleLoop = () => {
    if (isLooping) {
      setIsLooping(false);
      setLoopStart(null);
      setLoopEnd(null);
    } else if (loopStart !== null && loopEnd !== null) {
      setIsLooping(true);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

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
        <button 
          onClick={handleSaveRecording}
          disabled={!isRecorderFeatureReady || isRecording || isPlaying || recordedData.length === 0 || isSaving}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors shadow-md"
        >
          {isSaving ? 'Saving...' : 'Save Recording'}
        </button>
      </div>
      
      {/* Playback Controls */}
      {isPlayingBack && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-2 p-3 bg-gray-900 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Current Position:</span>
              <span className="text-white font-mono">{formatTime(currentPosition)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Elapsed Time:</span>
              <span className="text-white font-mono">{formatTime(elapsedTime)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Total Duration:</span>
              <span className="text-white font-mono">{formatTime(totalDuration)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRewind}
              disabled={!isPlayingBack}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded disabled:bg-gray-800 disabled:cursor-not-allowed"
            >
              ⏪ Rewind
            </button>
            <button
              onClick={handleFastForward}
              disabled={!isPlayingBack}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded disabled:bg-gray-800 disabled:cursor-not-allowed"
            >
              Fast Forward ⏩
            </button>
          </div>

          {/* Loop Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSetLoopStart}
              disabled={!isPlayingBack}
              className={`p-2 rounded ${loopStart !== null ? 'bg-green-600' : 'bg-gray-700'} hover:bg-opacity-80 disabled:bg-gray-800 disabled:cursor-not-allowed`}
            >
              Set Loop Start
            </button>
            <button
              onClick={handleSetLoopEnd}
              disabled={!isPlayingBack}
              className={`p-2 rounded ${loopEnd !== null ? 'bg-green-600' : 'bg-gray-700'} hover:bg-opacity-80 disabled:bg-gray-800 disabled:cursor-not-allowed`}
            >
              Set Loop End
            </button>
            <button
              onClick={handleToggleLoop}
              disabled={!isPlayingBack || (loopStart === null || loopEnd === null)}
              className={`p-2 rounded ${isLooping ? 'bg-yellow-600' : 'bg-gray-700'} hover:bg-opacity-80 disabled:bg-gray-800 disabled:cursor-not-allowed`}
            >
              {isLooping ? 'Stop Loop' : 'Start Loop'}
            </button>
          </div>

          {/* Loop Status */}
          {(loopStart !== null || loopEnd !== null) && (
            <div className="text-sm text-gray-300">
              Loop: {loopStart !== null ? formatTime(loopStart) : 'Not set'} - {loopEnd !== null ? formatTime(loopEnd) : 'Not set'}
            </div>
          )}
        </div>
      )}
      
      {saveSuccess && (
        <p className="p-2 my-2 bg-green-500 text-white rounded shadow">
          Recording saved successfully!
        </p>
      )}
      {saveError && (
        <p className="p-2 my-2 bg-red-500 text-white rounded shadow">
          Error: {saveError}
        </p>
      )}

      <CassetteTape progress={elapsedTime / totalDuration} isPlaying={isPlayingBack} />
      
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
    </div>
  );
} 