// It's highly recommended to install TypeScript types for the Spotify Web Playback SDK:
// npm install --save-dev @types/spotify-web-playback-sdk
// If you don't, you might need to use 'any' or define a basic global 'Spotify' namespace.

// Assuming global Spotify types are available via the SDK script and @types/spotify-web-playback-sdk
// If not, you would declare them here or in a spotify.d.ts file:
/*
declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify: {
      Player: new (options: Spotify.PlayerOptions) => Spotify.Player;
      // Add other Spotify types if needed
    };
  }
}
declare namespace Spotify {
  interface PlayerOptions {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }
  interface Player {
    connect: () => Promise<boolean>;
    disconnect: () => void;
    getCurrentState: () => Promise<PlaybackState | null>;
    getVolume: () => Promise<number>;
    setVolume: (volume: number) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    togglePlay: () => Promise<void>;
    seek: (position_ms: number) => Promise<void>;
    previousTrack: () => Promise<void>;
    nextTrack: () => Promise<void>;
    on: <E extends keyof Events>(event: E, callback: Events[E]) => boolean;
    removeListener: <E extends keyof Events>(event: E, callback?: Events[E]) => boolean;
    // Add other player methods and properties
  }
  interface PlaybackState {
    context: PlaybackContext;
    disallows: PlaybackDisallows;
    duration: number;
    paused: boolean;
    position: number;
    repeat_mode: number;
    shuffle: boolean;
    track_window: PlaybackTrackWindow;
    // Add other state properties
  }
  interface PlaybackContext {
    metadata: any;
    uri: string | null;
  }
  interface PlaybackDisallows {
    pausing?: boolean;
    peeking_next?: boolean;
    peeking_prev?: boolean;
    resuming?: boolean;
    seeking?: boolean;
    skipping_next?: boolean;
    skipping_prev?: boolean;
  }
  interface PlaybackTrackWindow {
    current_track: WebPlaybackTrack;
    next_tracks: WebPlaybackTrack[];
    previous_tracks: WebPlaybackTrack[];
  }
  interface WebPlaybackTrack {
    album: WebPlaybackAlbum;
    artists: WebPlaybackArtist[];
    duration_ms: number;
    id: string | null;
    is_playable: boolean;
    name: string;
    uri: string;
    // Add other track properties
  }
  interface WebPlaybackAlbum {
    images: WebPlaybackImage[];
    name: string;
    uri: string;
  }
  interface WebPlaybackArtist {
    name: string;
    uri: string;
  }
  interface WebPlaybackImage {
    height?: number | null;
    url: string;
    width?: number | null;
  }
  interface Error {
    message: string;
  }
  interface WebPlaybackInstance {
    device_id: string;
  }
  interface Events {
    ready: (instance: WebPlaybackInstance) => void;
    not_ready: (instance: WebPlaybackInstance) => void;
    player_state_changed: (state: PlaybackState | null) => void;
    initialization_error: (error: Error) => void;
    authentication_error: (error: Error) => void;
    account_error: (error: Error) => void;
    playback_error: (error: Error) => void;
    // Add other events
  }
}
*/


export interface RecordingSegment {
  type: 'track' | 'silence';
  sessionStartMs: number; // Absolute start time in the recording session (ms from recording start)
  durationMs: number;     // Actual duration of this segment

  // Track-specific properties (only if type === 'track')
  trackId?: string;
  trackStartMs?: number; // Start position *within* this track (from Spotify SDK)
  trackEndMs?: number;   // End position *within* this track (from Spotify SDK)
}

export interface SpotifyRecorderOptions {
  getOAuthToken: (cb: (token: string) => void) => void;
  onAuthError?: (error: Error) => void; // For API call auth errors
  onPlayerError?: (error: Error) => void; // For SDK player errors
  // For internally managed player
  playerName?: string; 
  // For externally managed player
  externalPlayer?: Spotify.Player;
  externalDeviceId?: string;
}

export class SpotifyRecorder {
  private player: Spotify.Player | null = null;
  private deviceId: string | null = null;
  private playerName: string | undefined;
  private getOAuthTokenCallback: (cb: (token: string) => void) => void;
  private onAuthErrorCallback?: (error: Error) => void;
  private onPlayerErrorCallback?: (error: Error) => void;

  private isExternalPlayer = false;

  private isRecording = false;
  private recordedSegments: RecordingSegment[] = [];
  private activeSpotifyTrackInfo: { 
    id: string;                 // Spotify Track URI
    spotifyStartMs: number;     // position_ms within the track when it started for this segment
    segmentSystemStartTime: number; // performance.now() when this segment recording began
  } | null = null;
  
  private masterRecordingStartTime: number | null = null;
  private lastEventSystemTime: number | null = null;
  private lastPlayerState: Spotify.PlaybackState | null = null;

  private isPlayingRecording = false;
  private currentPlaybackSegment: RecordingSegment | null = null;
  private currentPlaybackIndex = 0;
  private playbackSegmentsQueue: RecordingSegment[] = [];

  private currentOAuthToken: string | null = null;

  private MIN_SILENCE_THRESHOLD_MS = 50; // Minimum duration to record as a silence segment

  private playbackTimeoutId: ReturnType<typeof setTimeout> | null = null; // For setTimeout, ensure correct type for Node/Browser

  constructor(options: SpotifyRecorderOptions) {
    this.getOAuthTokenCallback = options.getOAuthToken;
    this.onAuthErrorCallback = options.onAuthError;
    this.onPlayerErrorCallback = options.onPlayerError;

    if (options.externalPlayer && options.externalDeviceId) {
      this.player = options.externalPlayer;
      this.deviceId = options.externalDeviceId;
      this.isExternalPlayer = true;
      console.log("[SpotifyRecorder] Initialized with external player. Device ID:", this.deviceId);
      // Directly attach internal listeners as the external player is assumed to be managed (connected/ready) elsewhere.
      this.attachInternalListeners();
    } else if (options.playerName) {
      this.playerName = options.playerName;
      this.isExternalPlayer = false;
      console.log("[SpotifyRecorder] Initialized for internal player management. Player Name:", this.playerName);
      // initialize() will need to be called to create and connect the player.
    } else {
      const errorMsg = "[SpotifyRecorder] Invalid options: Must provide either (externalPlayer and externalDeviceId) or playerName.";
      console.error(errorMsg);
      // Optionally throw error or call onPlayerErrorCallback
      if (this.onPlayerErrorCallback) {
        this.onPlayerErrorCallback(new Error(errorMsg));
      }
      // Recorder is in an unusable state.
    }
  }

  private attachInternalListeners(): void {
    if (!this.player) {
      console.error("[SpotifyRecorder] Cannot attach internal listeners: player instance is null.");
      return;
    }
    // Remove first to prevent duplicates if this method were called multiple times on the same player instance
    this.player.removeListener('player_state_changed', this.handlePlayerStateChange);
    this.player.on('player_state_changed', this.handlePlayerStateChange);
    console.log("[SpotifyRecorder] Attached internal 'player_state_changed' listener.");
  }

  // Call this if using an internal player, or if external player needs re-setup (less common)
  public async initialize(): Promise<string | null> {
    if (this.isExternalPlayer) {
      if (!this.player || !this.deviceId) {
        const error = new Error("[SpotifyRecorder] External player/deviceId was provided but is now null. This indicates an inconsistent state.");
        if (this.onPlayerErrorCallback) this.onPlayerErrorCallback(error);
        return Promise.reject(error);
      }
      console.log("[SpotifyRecorder] Initialize called with external player. Player assumed ready. Device ID:", this.deviceId);
      // Ensure listeners are attached if they weren't (e.g. if constructor didn't have player yet)
      this.attachInternalListeners(); 
      return Promise.resolve(this.deviceId);
    }

    // Logic for internally managed player
    if (!this.playerName) {
        const error = new Error("[SpotifyRecorder] Cannot initialize internal player without playerName.");
        if (this.onPlayerErrorCallback) this.onPlayerErrorCallback(error);
        return Promise.reject(error);
    }
    if (typeof window.Spotify === 'undefined' || typeof window.Spotify.Player === 'undefined') {
      const error = new Error("[SpotifyRecorder] Spotify Web Playback SDK is not loaded.");
      if (this.onPlayerErrorCallback) this.onPlayerErrorCallback(error);
      return Promise.reject(error);
    }

    console.log("[SpotifyRecorder] Initializing internally managed player:", this.playerName);
    this.player = new window.Spotify.Player({
      name: this.playerName,
      getOAuthToken: (cb: (token: string) => void) => {
        this.getOAuthTokenCallback(token => {
          this.currentOAuthToken = token; // Cache token for API calls made by recorder
          cb(token);
        });
      },
      volume: 0.5,
    });

    return new Promise((resolve, reject) => {
      this.addPlayerSdkListeners(resolve, reject); // Sets up SDK event handlers
      this.player!.connect().catch(error => {
        const connectError = new Error(`[SpotifyRecorder] Failed to connect internal player: ${error?.message || error}`);
        if (this.onPlayerErrorCallback) this.onPlayerErrorCallback(connectError);
        reject(connectError);
      });
    });
  }
  
  private addPlayerSdkListeners(
    resolveInitialize: (deviceId: string) => void, // Changed to string, as ready implies deviceId
    rejectInitialize: (reason?: any) => void
  ): void {
    if (!this.player) return; // Should be set before this is called for internal player

    this.player.on('ready', ({ device_id }: { device_id: string }) => {
      console.log('[SpotifyRecorder] Internally managed player READY. Device ID:', device_id);
      this.deviceId = device_id;
      this.attachInternalListeners(); // Attach core recording logic listeners
      resolveInitialize(device_id);
    });

    this.player.on('not_ready', ({ device_id }: { device_id: string }) => {
      console.log('[SpotifyRecorder] Internally managed player NOT READY. Device ID:', device_id);
      if (this.deviceId === device_id) { // If it was our active device
        this.deviceId = null; // Mark as not having a specific device ID
      }
      // This doesn't necessarily reject initialization, as 'ready' might come later or player might be taken over.
    });

    this.player.on('initialization_error', (error: Spotify.Error) => {
      const initError = new Error(`[SpotifyRecorder] Internal Player Initialization Error: ${error.message}`);
      console.error(initError.message);
      if (this.onPlayerErrorCallback) this.onPlayerErrorCallback(initError);
      rejectInitialize(initError);
    });

    this.player.on('authentication_error', (error: Spotify.Error) => {
      const authError = new Error(`[SpotifyRecorder] Internal Player Authentication Error: ${error.message}`);
      console.error(authError.message);
      this.currentOAuthToken = null;
      if (this.onAuthErrorCallback) this.onAuthErrorCallback(authError); // Notify main app of auth issue
      if (this.onPlayerErrorCallback) this.onPlayerErrorCallback(authError);
      rejectInitialize(authError);
    });

    this.player.on('account_error', (error: Spotify.Error) => {
      const accountError = new Error(`[SpotifyRecorder] Internal Player Account Error: ${error.message}`);
      // This is usually a non-premium user issue.
      console.error(accountError.message);
      if (this.onPlayerErrorCallback) this.onPlayerErrorCallback(accountError);
      // Don't necessarily reject, player might still "connect" but be unusable.
      // The UI should ideally guide the user.
    });

    this.player.on('playback_error', (error: Spotify.Error) => {
      const playbackError = new Error(`[SpotifyRecorder] Internal Player Playback Error: ${error.message}`);
      console.error(playbackError.message);
      if (this.onPlayerErrorCallback) this.onPlayerErrorCallback(playbackError);
    });

    // The 'player_state_changed' listener for recording logic is attached by attachInternalListeners
  }

  private handlePlayerStateChange = async (newState: Spotify.PlaybackState | null): Promise<void> => {
    if (!this.isRecording || !this.masterRecordingStartTime) {
      this.lastPlayerState = newState; // Keep it updated even if not recording for other purposes
      return;
    }

    const systemTimeOfEvent = performance.now();

    const currentTrackInNewState = newState?.track_window?.current_track;
    const isTrackEffectivelyPlaying = newState && currentTrackInNewState && !newState.paused && currentTrackInNewState.is_playable;

    if (this.activeSpotifyTrackInfo) {
      // A Spotify track segment was considered active
      if (isTrackEffectivelyPlaying && currentTrackInNewState.uri === this.activeSpotifyTrackInfo.id) {
        // Same track still playing. No segment change.
        // We don't update lastEventSystemTime here, as the current track segment is ongoing.
      } else {
        // Track changed, or stopped, or became unplayable. Finalize the active Spotify segment.
        const spotifyEndMs = this.lastPlayerState?.position ?? this.activeSpotifyTrackInfo.spotifyStartMs; // Use last state's position for accuracy
        this.finalizeSpotifyTrackSegment(spotifyEndMs, systemTimeOfEvent);
        // activeSpotifyTrackInfo is now null. lastEventSystemTime is updated to systemTimeOfEvent.

        // Now, if a new track is starting, handle it.
        if (isTrackEffectivelyPlaying) {
          this.startSpotifyTrackSegment(newState, systemTimeOfEvent); // This will record preceding silence if any.
        } else {
          // Track stopped, no new track starting immediately. The time from systemTimeOfEvent onwards is silence.
          // recordSilenceSegment will be called by stopRecording or by next track start.
        }
      }
    } else {
      // No Spotify track segment was active (implies silence was being recorded)
      if (isTrackEffectivelyPlaying) {
        // Silence ends, new track starts.
        this.recordSilenceSegment(systemTimeOfEvent); // Records silence from lastEventSystemTime up to systemTimeOfEvent
        this.startSpotifyTrackSegment(newState, systemTimeOfEvent);
      } else {
        // Still no track playing, or player state is null. Silence continues.
        // lastEventSystemTime remains where it was, extending the current silence period.
      }
    }
    if (this.isPlayingRecording && this.currentPlaybackSegment && this.currentPlaybackSegment.type === 'track') {
      const expectedTrackId = this.currentPlaybackSegment.trackId;
      // If the player state changes to a different track than expected during track playback,
      // it could be due to external interaction or the SDK auto-advancing.
      // The primary advancement is handled by setTimeout in playNextMasterSegment.
      // Here, we mainly log or could decide to stop playback if it's severely out of sync.
      if (newState?.track_window?.current_track?.uri !== expectedTrackId) {
        console.warn(`[SpotifyRecorder] Playback: Player state shows track ${newState?.track_window?.current_track?.uri}, but expected ${expectedTrackId}. Playback might be out of sync or ending.`);
        // Optionally, could call stopPlaybackOfRecording() here if this is considered a critical desync.
      }
    }
    this.lastPlayerState = newState;
  };

  private recordSilenceSegment(systemSilenceEndTime: number): void {
    if (!this.masterRecordingStartTime || !this.lastEventSystemTime) return;

    const silenceDuration = systemSilenceEndTime - this.lastEventSystemTime;
    if (silenceDuration >= this.MIN_SILENCE_THRESHOLD_MS) {
      const segment: RecordingSegment = {
        type: 'silence',
        sessionStartMs: Math.round(this.lastEventSystemTime - this.masterRecordingStartTime),
        durationMs: Math.round(silenceDuration),
      };
      this.recordedSegments.push(segment);
      console.log(`[SpotifyRecorder] Recorded Silence Segment: starts at ${segment.sessionStartMs}ms, duration ${segment.durationMs}ms.`);
    }
    this.lastEventSystemTime = systemSilenceEndTime;
  }

  private startSpotifyTrackSegment(spotifyPlayerState: Spotify.PlaybackState, systemSegmentStartTime: number): void {
    if (!this.masterRecordingStartTime || !spotifyPlayerState.track_window.current_track) return;
    
    // Any silence leading up to this point should have been recorded by the caller (e.g. handlePlayerStateChange)
    // by calling recordSilenceSegment(systemSegmentStartTime) before this.

    this.activeSpotifyTrackInfo = {
      id: spotifyPlayerState.track_window.current_track.uri,
      spotifyStartMs: spotifyPlayerState.position,
      segmentSystemStartTime: systemSegmentStartTime,
    };
    // The lastEventSystemTime is effectively now systemSegmentStartTime because a track segment has begun.
    // If there was a silence segment just before this, its recordSilenceSegment call would have updated lastEventSystemTime to systemSegmentStartTime.
    // If there wasn't (e.g. track changed to track immediately), lastEventSystemTime would be updated by the end of previous track segment.
    this.lastEventSystemTime = systemSegmentStartTime; 
    console.log(`[SpotifyRecorder] Started Spotify Track Segment: ${this.activeSpotifyTrackInfo.id} at its ${this.activeSpotifyTrackInfo.spotifyStartMs}ms. Session time: ${Math.round(systemSegmentStartTime - this.masterRecordingStartTime)}ms.`);
  }

  private finalizeSpotifyTrackSegment(spotifyTrackEndPositionInTrackMs: number, systemSegmentEndTime: number): void {
    if (!this.activeSpotifyTrackInfo || !this.masterRecordingStartTime) return;

    const segmentDuration = systemSegmentEndTime - this.activeSpotifyTrackInfo.segmentSystemStartTime;
    
    // Ensure duration is not negative if system times are weird, though unlikely with performance.now()
    const positiveDurationMs = Math.max(0, segmentDuration);

    const segment: RecordingSegment = {
      type: 'track',
      trackId: this.activeSpotifyTrackInfo.id,
      trackStartMs: this.activeSpotifyTrackInfo.spotifyStartMs,
      trackEndMs: spotifyTrackEndPositionInTrackMs,
      sessionStartMs: Math.round(this.activeSpotifyTrackInfo.segmentSystemStartTime - this.masterRecordingStartTime),
      durationMs: Math.round(positiveDurationMs),
    };
    this.recordedSegments.push(segment);
    console.log(`[SpotifyRecorder] Finalized Spotify Track Segment: ${segment.trackId} (ends at its ${segment.trackEndMs}ms). Session time: ${segment.sessionStartMs}ms, duration ${segment.durationMs}ms.`);
    
    this.activeSpotifyTrackInfo = null;
    this.lastEventSystemTime = systemSegmentEndTime;
  }

  public async startRecording(): Promise<boolean> {
    if (!this.player || !this.deviceId) {
      const errorMsg = '[SpotifyRecorder] Player not available or not ready (no deviceId). Cannot start recording.';
      console.error(errorMsg);
      if (this.onPlayerErrorCallback) this.onPlayerErrorCallback(new Error(errorMsg));
      return false;
    }
    if (this.isRecording) {
      console.warn('[SpotifyRecorder] Recording is already in progress.');
      return false;
    }

    this.isRecording = true;
    this.recordedSegments = [];
    this.activeSpotifyTrackInfo = null;
    this.masterRecordingStartTime = performance.now();
    this.lastEventSystemTime = this.masterRecordingStartTime;
    this.lastPlayerState = null; // Reset last known state
    
    console.log(`[SpotifyRecorder] Recording started. Master time: ${this.masterRecordingStartTime}.`);

    try {
        const initialState = await this.player.getCurrentState();
        this.lastPlayerState = initialState; // Store it immediately

        if (initialState && initialState.track_window.current_track && !initialState.paused && initialState.track_window.current_track.is_playable) {
          // A track is playing right at the start of recording.
          // No silence segment before it, as lastEventSystemTime is masterRecordingStartTime.
          this.startSpotifyTrackSegment(initialState, this.masterRecordingStartTime);
        } else {
          console.log('[SpotifyRecorder] Recording started. Player paused, no track, or track not playable initially. Silence recording begins.');
          // Silence is implicitly being recorded until a track starts or recording stops.
          // lastEventSystemTime remains masterRecordingStartTime.
        }
    } catch (error: any) {
        console.error("[SpotifyRecorder] Error getting initial player state for recording:", error.message);
        // Potentially stop recording if this fails critically? For now, continue, might record silence.
    }
    return true;
  }

  public async stopRecording(): Promise<void> { // Made async because it might await player state
    if (!this.isRecording || !this.masterRecordingStartTime) return;

    this.isRecording = false; // Set this first to prevent races with player_state_changed
    const systemStopTime = performance.now();

    if (this.activeSpotifyTrackInfo) {
      // A track was actively being recorded, finalize it.
      let spotifyEndMs = this.activeSpotifyTrackInfo.spotifyStartMs; // Default fallback
      try {
        const endState = await this.player?.getCurrentState(); // Get fresh state
        if (endState && endState.track_window.current_track?.uri === this.activeSpotifyTrackInfo.id) {
          spotifyEndMs = endState.position;
        } else if (this.lastPlayerState && this.lastPlayerState.track_window.current_track?.uri === this.activeSpotifyTrackInfo.id) {
          spotifyEndMs = this.lastPlayerState.position; // Fallback to last known state for this track
        }
      } catch(e) {
        console.warn('[SpotifyRecorder] Error getting player state on stopRecording for active segment, using fallback endMs.', e);
      }
      this.finalizeSpotifyTrackSegment(spotifyEndMs, systemStopTime);
      // activeSpotifyTrackInfo is now null, lastEventSystemTime is systemStopTime.
    }
    
    // After finalizing any active track, record any remaining silence up to systemStopTime
    this.recordSilenceSegment(systemStopTime); 

    console.log('[SpotifyRecorder] Recording finished. Segments:', JSON.parse(JSON.stringify(this.recordedSegments)));
    const totalDuration = systemStopTime - this.masterRecordingStartTime;
    console.log(`[SpotifyRecorder] Total master timeline duration: ${Math.round(totalDuration)}ms.`);

    this.masterRecordingStartTime = null;
    this.lastEventSystemTime = null;
    this.activeSpotifyTrackInfo = null;
    // this.lastPlayerState = null; // Keep lastPlayerState, might be useful
  }

  public getRecording(): RecordingSegment[] {
    return [...this.recordedSegments];
  }

  public async playRecording(segmentsToPlay?: RecordingSegment[]): Promise<boolean> {
    if (!this.player || !this.deviceId) {
      const error = new Error('[SpotifyRecorder] Player not initialized or not ready for playback.');
      console.error(error.message);
      if (this.onPlayerErrorCallback) this.onPlayerErrorCallback(error);
      return false;
    }
    if (this.isPlayingRecording) {
      console.warn('[SpotifyRecorder] Playback is already in progress. Stop current playback first.');
      return false;
    }

    this.playbackSegmentsQueue = segmentsToPlay ? [...segmentsToPlay] : [...this.recordedSegments];
    if (this.playbackSegmentsQueue.length === 0) {
      console.log('[SpotifyRecorder] No segments to play.');
      return true;
    }
    
    // Simplified OAuth check for now, as SDK calls are primary for playback itself
    if (!this.currentOAuthToken) {
      await new Promise<void>((resolve, reject) => {
        this.getOAuthTokenCallback(token => {
          if (token) {
            this.currentOAuthToken = token;
            resolve();
          } else {
            const tokenFetchError = new Error("[SpotifyRecorder] Failed to get OAuth token for playback startup.");
            if(this.onAuthErrorCallback) this.onAuthErrorCallback(tokenFetchError);
            console.error(tokenFetchError.message);
            reject(tokenFetchError);
          }
        });
      }).catch(() => { /* Error already handled by callback */ });

       if (!this.currentOAuthToken) {
         console.error("[SpotifyRecorder] Playback cannot proceed without OAuth token for initial API calls (if any were needed).");
         return false;
       }
    }

    this.isPlayingRecording = true;
    this.currentPlaybackIndex = 0;
    this.currentPlaybackSegment = null;
    if (this.playbackTimeoutId) {
      clearTimeout(this.playbackTimeoutId); // No need to cast if using ReturnType<typeof setTimeout>
      this.playbackTimeoutId = null;
    }
    console.log('[SpotifyRecorder] Starting playback of master recording...');
    this.playNextMasterSegment(); // Start the sequence
    return true;
  }

  private async playNextMasterSegment(): Promise<void> {
    if (!this.isPlayingRecording || this.currentPlaybackIndex >= this.playbackSegmentsQueue.length) {
      console.log('[SpotifyRecorder] Master playback queue finished or stopped.');
      this.stopPlaybackOfRecording(false); // Ensure everything is cleaned up, don't try to pause player again if it was natural end
      return;
    }

    this.currentPlaybackSegment = this.playbackSegmentsQueue[this.currentPlaybackIndex] ?? null;
    if (!this.currentPlaybackSegment) {
      console.error("[SpotifyRecorder] Error: Tried to play an undefined segment from master queue.");
      this.stopPlaybackOfRecording(false);
      return;
    }

    const segment = this.currentPlaybackSegment;
    console.log(`[SpotifyRecorder] Master Playback: Segment ${this.currentPlaybackIndex + 1}/${this.playbackSegmentsQueue.length}, Type: ${segment.type}, SessionStart: ${segment.sessionStartMs}ms, Duration: ${segment.durationMs}ms`);

    if (segment.type === 'silence') {
      console.log(`[SpotifyRecorder] Playing silence for ${segment.durationMs}ms`);
      this.playbackTimeoutId = setTimeout(() => {
        if (!this.isPlayingRecording) return; // Playback might have been stopped during silence
        this.currentPlaybackIndex++;
        this.playNextMasterSegment();
      }, segment.durationMs);
    } else if (segment.type === 'track' && segment.trackId && typeof segment.trackStartMs === 'number') {
      console.log(`[SpotifyRecorder] Playing track: ${segment.trackId} from ${segment.trackStartMs}ms (for ${segment.durationMs}ms)`);
      if (!this.player || !this.deviceId || !this.currentOAuthToken) {
        console.error("[SpotifyRecorder] Player, Device ID, or OAuth token missing for track playback API call.");
        this.stopPlaybackOfRecording(true);
        return;
      }

      const maxRetries = 3;
      let retryCount = 0;
      let success = false;

      while (retryCount < maxRetries && !success) {
        try {
          // First ensure the device is active
          const deviceResponse = await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.currentOAuthToken}`,
            },
            body: JSON.stringify({
              device_ids: [this.deviceId],
              play: false
            }),
          });

          if (!deviceResponse.ok) {
            throw new Error(`Failed to activate device: ${deviceResponse.status} ${deviceResponse.statusText}`);
          }

          // Now try to play the track
          const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.currentOAuthToken}`,
            },
            body: JSON.stringify({
              uris: [segment.trackId],
              position_ms: segment.trackStartMs,
            }),
          });
          
          if (!response.ok) {
            const errorBody = await response.text();
            if (response.status === 404) {
              console.warn(`[SpotifyRecorder] Track not found (404): ${segment.trackId}. Retrying...`);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
              continue;
            }
            throw new Error(`Spotify API Error (${response.status}): ${response.statusText}. Body: ${errorBody}`);
          }

          success = true;
        } catch (error: any) {
          console.error(`[SpotifyRecorder] Attempt ${retryCount + 1}/${maxRetries} failed:`, error.message);
          if (error.message.includes('401') && this.onAuthErrorCallback) {
            this.currentOAuthToken = null;
            this.onAuthErrorCallback(error);
            this.stopPlaybackOfRecording(true);
            return;
          }
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
          } else {
            if (this.onPlayerErrorCallback) {
              this.onPlayerErrorCallback(error);
            }
            this.stopPlaybackOfRecording(true);
            return;
          }
        }
      }

      if (!success) {
        console.error("[SpotifyRecorder] Failed to play track after all retries");
        this.stopPlaybackOfRecording(true);
        return;
      }

      // Track is commanded to play. Now set a timeout for its recorded duration.
      this.playbackTimeoutId = setTimeout(async () => {
        if (!this.isPlayingRecording) return; // Playback might have been stopped
        
        console.log(`[SpotifyRecorder] Track segment ${segment.trackId} recorded duration (${segment.durationMs}ms) elapsed.`);
        try {
          if (this.player && typeof this.player.pause === 'function') {
            // Attempt to pause the player, as this segment's time on the master timeline is up.
            await this.player.pause();
            console.log('[SpotifyRecorder] Paused player after track segment duration elapsed.');
          }
        } catch (pauseError: any) {
          console.warn('[SpotifyRecorder] Could not pause player after track segment duration:', pauseError.message);
        }
        this.currentPlaybackIndex++;
        this.playNextMasterSegment();
      }, segment.durationMs);

    } else {
      console.warn('[SpotifyRecorder] Skipping invalid segment in master playback:', segment);
      this.currentPlaybackIndex++;
      this.playNextMasterSegment(); // Skip and try next
    }
  }

  public stopPlaybackOfRecording(pausePlayer = true): void {
    if (!this.isPlayingRecording && !pausePlayer && !this.playbackTimeoutId) {
       if(!this.isPlayingRecording && !this.playbackTimeoutId) return; // Already stopped and no timeout to clear
    }

    console.log('[SpotifyRecorder] Stopping playback of recording.');
    this.isPlayingRecording = false;
    this.currentPlaybackSegment = null;
    this.currentPlaybackIndex = 0;
    this.playbackSegmentsQueue = [];
    
    if (this.playbackTimeoutId) {
      clearTimeout(this.playbackTimeoutId); // No need to cast if using ReturnType<typeof setTimeout>
      this.playbackTimeoutId = null;
      console.log('[SpotifyRecorder] Cleared active playback timeout.');
    }
    
    if (pausePlayer && this.player && typeof this.player.pause === 'function') {
      this.player.pause().catch(err => console.warn("[SpotifyRecorder] Error pausing player on stopPlayback:", err?.message || err));
    }
  }

  public dispose(): void {
    console.log('[SpotifyRecorder] Disposing recorder...');
    this.stopRecording();
    this.stopPlaybackOfRecording(false); // Don't try to pause player, just stop internal logic

    if (this.player) {
      // Always remove internal listeners
      this.player.removeListener('player_state_changed', this.handlePlayerStateChange);
      console.log("[SpotifyRecorder] Removed internal 'player_state_changed' listener.");

      if (!this.isExternalPlayer) {
        // Only disconnect if player is internally managed
        console.log('[SpotifyRecorder] Disconnecting internally managed player.');
        this.player.disconnect();
        this.player = null; // Clear internal reference
        this.deviceId = null;
      } else {
        console.log('[SpotifyRecorder] Not disconnecting or nullifying externally managed player.');
        // For external players, we might want to nullify our reference to it,
        // but the caller (context) is responsible for its lifecycle.
        // For safety, if the recorder is disposed, it shouldn't hold onto player ref.
        this.player = null; 
        this.deviceId = null;
      }
    }
    
    this.currentOAuthToken = null; // Clear cached token
    console.log('[SpotifyRecorder] Recorder disposed.');
  }

  // Get the current playback position in milliseconds
  public getCurrentPosition(): number {
    if (!this.lastPlayerState) return 0;
    return this.lastPlayerState.position;
  }

  // Seek to a specific position in milliseconds
  public async seekTo(positionMs: number): Promise<void> {
    if (!this.player) {
      console.error('[SpotifyRecorder] Cannot seek: Player not available');
      return;
    }
    try {
      await this.player.seek(positionMs);
    } catch (error) {
      console.error('[SpotifyRecorder] Error seeking to position:', error);
      if (this.onPlayerErrorCallback) {
        this.onPlayerErrorCallback(error instanceof Error ? error : new Error('Failed to seek'));
      }
    }
  }

  // Get the total duration of the current track in milliseconds
  public getDuration(): number {
    if (!this.lastPlayerState) return 0;
    return this.lastPlayerState.duration;
  }

  // Get the current playback segment
  public getCurrentPlaybackSegment(): RecordingSegment | null {
    return this.currentPlaybackSegment;
  }

  // Get the current player state
  public async getCurrentState(): Promise<Spotify.PlaybackState | null> {
    if (!this.player) return null;
    try {
      return await this.player.getCurrentState();
    } catch (error) {
      console.error('[SpotifyRecorder] Error getting current state:', error);
      return null;
    }
  }
} 