import { BackslashIcon, EnterIcon, MicrophoneIcon } from "./Icons";
import { useEffect, useRef, useState } from "react";

import { COMMAND_KEY } from "../utils/platform";
import { Settings } from "lucide-react";
import Tooltip from "./shared/Tooltip";

interface CommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void;
  view: "initial" | "response" | "followup";
  isLoading?: boolean;
}

export default function Commands({
  onTooltipVisibilityChange,
  view,
  isLoading = false,
}: CommandsProps) {
  const isInitialView = view === "initial";
  const showAskFollowUp = !isInitialView && !isLoading;
  const [isRecording, setIsRecording] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(
    null
  );
  const [recordingElapsedTime, setRecordingElapsedTime] = useState(0);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [recordingMode, setRecordingMode] = useState<string | null>(null);

  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);

  // Debug: log when component mounts/unmounts
  useEffect(() => {
    console.log(`Commands component mounted with view: ${view}`);
    return () => {
      console.log(`Commands component unmounted from view: ${view}`);
    };
  }, [view]);

  // Load current custom prompt on mount
  useEffect(() => {
    const loadCurrentPrompt = async () => {
      try {
        const response = await (window.electronAPI as any).getApiConfig();
        if (response.success && response.customPrompt) {
          setCustomPrompt(response.customPrompt);
        }
      } catch (error) {
        console.error("Failed to load custom prompt:", error);
      }
    };
    loadCurrentPrompt();
  }, []);

  const MAX_RECORDING_TIME = (59 * 60 + 59) * 1000;

  const formatElapsedTime = (timeMs: number) => {
    const totalSeconds = Math.floor(timeMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Save custom prompt when it changes
  const handleCustomPromptChange = async (newPrompt: string) => {
    setCustomPrompt(newPrompt);
    try {
      await (window.electronAPI as any).setCustomPrompt(newPrompt);
    } catch (error) {
      console.error("Failed to save custom prompt:", error);
    }
  };

  useEffect(() => {
    // Initialize recording state from backend when component mounts
    const initializeRecordingState = async () => {
      try {
        const status = await window.electronAPI.getAudioRecordingStatus();
        if (status.isRecording && status.recording) {
          setIsRecording(true);
          setIsStartingRecording(false);
          setRecordingStartTime(status.recording.startTime);
          setRecordingElapsedTime(Date.now() - status.recording.startTime);
          console.log("Initialized recording state from backend:", status);
        }
      } catch (error) {
        console.error("Failed to initialize recording state:", error);
      }
    };

    // Initialize state on mount
    initializeRecordingState();

    // Listen for real-time recording status changes instead of polling
    const unsubscribe = window.electronAPI.onAudioRecordingStatusChanged(
      ({ isRecording: newIsRecording, recording, recordingMode }) => {
        console.log("Recording status changed:", { newIsRecording, recording, recordingMode });
        
        // Only update if the recording state actually changed
        if (newIsRecording !== isRecording) {
          setIsRecording(newIsRecording);
          setRecordingMode(recordingMode || null);
          
          if (newIsRecording && recording?.startTime) {
            // Recording just started
            console.log("Recording started via status change - startTime:", recording.startTime);
            setIsStartingRecording(false);
            
            // Only update start time if we don't already have one (to prevent timer reset)
            if (!recordingStartTimeRef.current) {
              setRecordingStartTime(recording.startTime);
              recordingStartTimeRef.current = recording.startTime;
              console.log("Recording started - real-time event detected");
            } else {
              console.log("Recording already in progress, not updating start time");
            }
          } else if (!newIsRecording) {
            // Recording just stopped
            console.log("Recording stopped via status change");
            setIsStartingRecording(false);
            setRecordingStartTime(null);
            recordingStartTimeRef.current = null;
            setRecordingElapsedTime(0);
            setRecordingMode(null);
            console.log("Recording stopped - real-time event detected");
          }
        } else {
          console.log("Recording status unchanged, ignoring update");
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []); // Remove isRecording dependency to prevent re-subscription

  useEffect(() => {
    console.log("Timer effect dependency changed - isRecording:", isRecording, "recordingStartTimeRef:", recordingStartTimeRef.current);
    
    if (isRecording && recordingStartTimeRef.current) {
      console.log("Timer effect triggered - isRecording:", isRecording, "startTime:", recordingStartTimeRef.current);
      
      const updateElapsedTime = () => {
        const elapsed = Date.now() - recordingStartTimeRef.current!;
        console.log("Timer update - elapsed:", elapsed, "ms");
        setRecordingElapsedTime(elapsed);

        if (elapsed >= MAX_RECORDING_TIME) {
          handleStopRecording();
        }
      };

      updateElapsedTime();
      const interval = setInterval(updateElapsedTime, 100);
      return () => {
        console.log("Clearing timer interval");
        clearInterval(interval);
      };
    } else {
      console.log("Timer effect not running - isRecording:", isRecording, "startTime:", recordingStartTimeRef.current);
    }
  }, [isRecording]); // Remove recordingStartTime dependency

  const handleStopRecording = async () => {
    try {
      const result = await window.electronAPI.stopAudioRecording();
      if (result.success) {
        // UI will be updated by the real-time event when recording actually stops
        console.log("Recording stop command sent, waiting for actual recording to stop...");
      } else {
        console.error("Failed to stop recording:", result.error);
        // Keep current recording state since stop failed
      }
    } catch (error) {
      console.error("Error stopping audio recording:", error);
      // Keep current recording state since stop failed
    }
  };
  // Listen for start-microphone-recording message from main process
  useEffect(() => {
    const handleStartRecording = () => {
      console.log("Received start-microphone-recording message from main process");
      startMicrophoneRecording();
    };

    // Listen for the message from main process
    const cleanup = window.electronAPI.onStartMicrophoneRecording?.(handleStartRecording);
    
    return () => {
      // Cleanup if needed
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const handleMicrophoneClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isRecording) {
      console.log("Stopping audio recording...");
      setIsRecording(false);
      setIsStartingRecording(false);
      setRecordingStartTime(null);
      recordingStartTimeRef.current = null;
      setRecordingElapsedTime(0);
      
      // Stop microphone recording and clean up
      stopMicrophoneRecording();
      
      try {
        const result = await window.electronAPI.stopAudioRecording();
        console.log("Stop recording result:", result);
      } catch (error) {
        console.error("Error stopping recording:", error);
      }
    } else {
      console.log("Starting audio recording...");
      setIsStartingRecording(true);
      
      // Reset any previous recording state
      stopMicrophoneRecording(); // Clean up any existing recording
      
      try {
        // Start the main process recording (which will trigger microphone recording)
        const result = await window.electronAPI.startAudioRecording();
        console.log("Start recording result:", result);
        
        if (result.success) {
          console.log("Recording start successful - setting timer start time");
          setIsRecording(true);
          setIsStartingRecording(false);
          const startTime = Date.now();
          setRecordingStartTime(startTime);
          recordingStartTimeRef.current = startTime;
          setRecordingElapsedTime(0); // Reset timer for new recording
          console.log("Timer reset to 0 for new recording");
        } else {
          console.error("Failed to start recording:", result.error);
          setIsStartingRecording(false);
        }
      } catch (error) {
        console.error("Error starting recording:", error);
        setIsStartingRecording(false);
      }
    }
  };

  const handleMicrophoneMouseEnter = () => {
    window.electronAPI.setInteractiveMouseEvents();
  };

  const handleMicrophoneMouseLeave = () => {
    window.electronAPI.setIgnoreMouseEvents();
  };

  const handlePromptMouseEnter = () => {
    window.electronAPI.setInteractiveMouseEvents();
  };

  const handlePromptMouseLeave = () => {
    window.electronAPI.setIgnoreMouseEvents();
  };

  const handlePromptKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // Only trigger if there's a custom prompt
      if (customPrompt.trim()) {
        try {
          // Process the custom prompt directly with the AI model
          await window.electronAPI.processDirectPrompt(customPrompt.trim());
        } catch (error) {
          console.error("Failed to process direct prompt:", error);
        }
      }
    }
  };

  // Audio recording functions
  const startMicrophoneRecording = async () => {
    try {
      console.log("Starting microphone recording via Web Audio API...");
      
      // Request microphone access with optimized settings for speech recognition
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000, // Optimal for Whisper
          channelCount: 1, // Mono for better transcription
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Additional settings for better quality
          sampleSize: 16
        } 
      });
      
      streamRef.current = stream;
      
      // Create MediaRecorder with optimized settings for speech
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000 // Higher bitrate for better quality
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Handle data available - collect larger chunks for better quality
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Convert blob to array buffer and send to main process
          event.data.arrayBuffer().then(buffer => {
            const uint8Array = new Uint8Array(buffer);
            window.electronAPI.sendAudioData({ buffer: Array.from(uint8Array) });
          });
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = () => {
        console.log("MediaRecorder stopped");
        
        // Combine all audio chunks and send final data
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioBlob.arrayBuffer().then(buffer => {
            const uint8Array = new Uint8Array(buffer);
            window.electronAPI.sendAudioData({ buffer: Array.from(uint8Array), isFinal: true });
            window.electronAPI.sendRecordingComplete();
          });
        } else {
          window.electronAPI.sendRecordingComplete();
        }
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      
      // Handle recording error
      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        window.electronAPI.sendRecordingError({ error: "MediaRecorder error" });
      };
      
      // Start recording with larger time slices for better quality
      mediaRecorder.start(500); // Collect data every 500ms for better chunks
      console.log("✅ Microphone recording started successfully with optimized settings");
      
    } catch (error) {
      console.error("Failed to start microphone recording:", error);
      window.electronAPI.sendRecordingError({ error: (error as Error).message });
    }
  };

  const stopMicrophoneRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Clean up the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Reset the recorder
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  return (
    <div className="select-none">
      <div className="pt-2 w-fit">
        <div className="text-xs text-foreground backdrop-blur-md bg-background/80 rounded-lg py-2 px-4 flex items-center justify-start gap-3 pointer-events-auto border-0" style={{ borderRadius: '0.5rem' }}>
          <div className="flex items-center gap-2 rounded px-2 py-1.5 pointer-events-none select-none">
            <span className="text-xs leading-none truncate">Show/Hide</span>
            <div className="flex gap-1">
              <button className="bg-muted rounded-md px-1.5 py-1 text-xs leading-none">
                {COMMAND_KEY}
              </button>
              <button className="bg-muted rounded-md px-1.5 py-1 text-xs leading-none">
                {BackslashIcon}
              </button>
            </div>
          </div>

          {(isInitialView || showAskFollowUp) && (
            <div className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors pointer-events-none select-none">
              <span className="text-xs leading-none truncate">
                {isInitialView ? "Ask AI" : "Ask Follow Up"}
              </span>
              <div className="flex gap-1">
                <button className="bg-muted rounded-md px-1.5 py-1 text-xs leading-none">
                  {COMMAND_KEY}
                </button>
                <button className="bg-muted rounded-md px-1.5 py-1 text-xs leading-none">
                  {EnterIcon}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors pointer-events-none select-none">
            <span className="text-xs leading-none truncate">Reset</span>
            <div className="flex gap-1 flex-shrink-0">
              <span className="bg-muted px-1.5 py-0.5 rounded text-xs leading-none">
                {COMMAND_KEY}
              </span>
              <span className="bg-muted px-1.5 py-0.5 rounded text-xs leading-none">
                R
              </span>
            </div>
          </div>

          <button
            onClick={handleMicrophoneClick}
            onMouseEnter={handleMicrophoneMouseEnter}
            onMouseLeave={handleMicrophoneMouseLeave}
            disabled={isStartingRecording}
            className={`flex items-center gap-2 rounded px-2 py-1.5 transition-colors cursor-pointer hover:bg-muted/50 border-0 text-foreground ${
              recordingMode === "mock" && isRecording ? "bg-yellow-500/20 border border-yellow-500/30" : "bg-transparent"
            }`}
            type="button"
            title={
              isRecording
                ? recordingMode === "mock"
                  ? `Mock recording for ${formatElapsedTime(recordingElapsedTime)} - Click to stop (simulated audio)`
                  : `Recording for ${formatElapsedTime(recordingElapsedTime)} - Click to stop`
                : isStartingRecording
                ? "Starting recording..."
                : "Start recording audio (system + microphone if available)"
            }
          >
            <span className="text-xs leading-none truncate">
              {isRecording ? formatElapsedTime(recordingElapsedTime) : 
               isStartingRecording ? "..." : "00:00"}
            </span>
            <div className="flex gap-1 flex-shrink-0">
              <MicrophoneIcon isRecording={isRecording || isStartingRecording} className="h-3 w-3" />
            </div>
          </button>

          <div className="mx-2 h-4 w-px bg-border" />

                     {/* Custom Prompt Input */}
           <div 
             className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors pointer-events-auto"
             onMouseEnter={handlePromptMouseEnter}
             onMouseLeave={handlePromptMouseLeave}
           >
             <span className="text-xs leading-none truncate whitespace-nowrap pointer-events-none">Prompt:</span>
             <div className="flex gap-1 flex-shrink-0">
                               <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => handleCustomPromptChange(e.target.value)}
                  onKeyDown={handlePromptKeyDown}
                  onFocus={() => setIsPromptFocused(true)}
                  onBlur={() => setIsPromptFocused(false)}
                  placeholder="Ask AI anything..."
                  title="Type a question or prompt and press Enter to get an AI response. This works independently of screenshots."
                  className={`bg-muted/50 rounded-md px-2 py-1 text-xs leading-none border-0 outline-none transition-colors ${
                    isPromptFocused ? 'bg-muted ring-1 ring-ring' : 'hover:bg-muted'
                  }`}
                  style={{ width: '140px' }}
                />
             </div>
           </div>

          <div className="mx-2 h-4 w-px bg-border" />

          <button
            className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors cursor-pointer hover:bg-muted/50 bg-transparent border-0 text-foreground"
            type="button"
            title="Settings"
          >
            <Tooltip
              onVisibilityChange={onTooltipVisibilityChange}
              trigger={<Settings className="h-4 w-4" />}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
