import { BackslashIcon, EnterIcon, MicrophoneIcon } from "./icons";
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
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(
    null
  );
  const [recordingElapsedTime, setRecordingElapsedTime] = useState(0);

  // Persistent state for status check control
  const statusCheckControl = useRef({
    skipStatusChecks: false,
    lastUserInteraction: 0,
  });

  // Maximum recording time in milliseconds (59 minutes 59 seconds)
  const MAX_RECORDING_TIME = (59 * 60 + 59) * 1000;

  // Format elapsed time as MM:SS or HH:MM:SS
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

  // Check recording status on mount and update periodically
  useEffect(() => {
    let consecutiveStoppedChecks = 0;
    const REQUIRED_STOPPED_CHECKS = 2; // Require 2 consecutive checks showing stopped before resetting

    const checkRecordingStatus = async () => {
      try {
        // Skip status check if user just interacted or if explicitly disabled
        const timeSinceLastInteraction =
          Date.now() - statusCheckControl.current.lastUserInteraction;
        if (
          timeSinceLastInteraction < 2000 ||
          statusCheckControl.current.skipStatusChecks
        ) {
          return;
        }

        const result = await window.electronAPI.getAudioRecordingStatus();
        if (result.success) {
          const wasRecording = isRecording;

          // Handle recording state changes with debouncing to prevent false positives during processing
          if (!result.isRecording && wasRecording) {
            consecutiveStoppedChecks++;
            console.log(
              `Recording appears stopped (check ${consecutiveStoppedChecks}/${REQUIRED_STOPPED_CHECKS})`
            );

            // Only reset timer after consecutive checks confirm recording is truly stopped
            if (consecutiveStoppedChecks >= REQUIRED_STOPPED_CHECKS) {
              setIsRecording(false);
              setRecordingStartTime(null);
              setRecordingElapsedTime(0);
              console.log("Recording confirmed stopped, resetting timer");
              consecutiveStoppedChecks = 0;
            }
          } else if (result.isRecording) {
            // Reset counter if recording is active
            consecutiveStoppedChecks = 0;
            if (!wasRecording) {
              // Only sync external recording state if we haven't had recent user interaction
              const timeSinceLastInteraction =
                Date.now() - statusCheckControl.current.lastUserInteraction;
              if (timeSinceLastInteraction > 3000) {
                // Recording started externally, sync state and set start time if not already set
                setIsRecording(true);
                if (!recordingStartTime) {
                  const currentTime = Date.now();
                  setRecordingStartTime(currentTime);
                  setRecordingElapsedTime(0);
                  console.log(
                    "Recording detected as active, syncing state and setting start time"
                  );
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error checking recording status:", error);
      }
    };

    // Function to mark user interaction
    const markUserInteraction = () => {
      statusCheckControl.current.lastUserInteraction = Date.now();
    };

    checkRecordingStatus();
    // Check every 500ms for more responsive UI while still preventing false positives
    const interval = setInterval(checkRecordingStatus, 500);

    return () => {
      clearInterval(interval);
    };
  }, [isRecording, recordingStartTime]); // Added recordingStartTime back to dependencies

  // Update elapsed time when recording
  useEffect(() => {
    if (isRecording && recordingStartTime) {
      const updateElapsedTime = () => {
        const elapsed = Date.now() - recordingStartTime;
        setRecordingElapsedTime(elapsed);

        // Stop recording if max time reached
        if (elapsed >= MAX_RECORDING_TIME) {
          handleStopRecording();
        }
      };

      // Update immediately
      updateElapsedTime();
      // Update every 100ms for smoother display
      const interval = setInterval(updateElapsedTime, 100);
      return () => clearInterval(interval);
    }
  }, [isRecording, recordingStartTime]);

  const handleStopRecording = async () => {
    try {
      console.log("Stopping recording...");
      const result = await window.electronAPI.stopAudioRecording();
      if (result.success) {
        console.log("Audio recording stopped:", result.recording);
      } else {
        console.error("Failed to stop recording:", result.error);
        // On error, revert UI state since the recording might still be active
        setIsRecording(true);
        // We need a start time for the timer to work, estimate it
        const estimatedStartTime = Date.now() - recordingElapsedTime;
        setRecordingStartTime(estimatedStartTime);
      }
    } catch (error) {
      console.error("Error stopping audio recording:", error);
      // On error, revert UI state
      setIsRecording(true);
      const estimatedStartTime = Date.now() - recordingElapsedTime;
      setRecordingStartTime(estimatedStartTime);
    }
  };
  const handleMicrophoneClick = async (e: React.MouseEvent) => {
    console.log("Microphone button clicked!"); // Debug log
    e.preventDefault();
    e.stopPropagation();

    // IMMEDIATELY disable status checking BEFORE any UI changes to prevent flickering
    statusCheckControl.current.skipStatusChecks = true;
    statusCheckControl.current.lastUserInteraction = Date.now();

    try {
      if (isRecording) {
        // Immediately update UI for better responsiveness
        setIsRecording(false);
        setRecordingStartTime(null);
        setRecordingElapsedTime(0);
        await handleStopRecording();
      } else {
        // Immediately update UI for better responsiveness
        const startTime = Date.now();
        setIsRecording(true);
        setRecordingStartTime(startTime);
        setRecordingElapsedTime(0);

        console.log("Starting recording...");
        const result = await window.electronAPI.startAudioRecording();
        if (!result.success) {
          // If recording failed, revert UI state
          setIsRecording(false);
          setRecordingStartTime(null);
          setRecordingElapsedTime(0);
          console.error("Failed to start recording:", result.error);
        } else {
          console.log("Audio recording started");
        }
      }
    } catch (error) {
      // If error occurred, revert to stopped state
      setIsRecording(false);
      setRecordingStartTime(null);
      setRecordingElapsedTime(0);
      console.error("Error toggling audio recording:", error);
    } finally {
      // Re-enable status checks after 3 seconds
      setTimeout(() => {
        statusCheckControl.current.skipStatusChecks = false;
      }, 3000);
    }
  };

  const handleMicrophoneMouseEnter = () => {
    console.log("Mouse entered microphone button");
    window.electronAPI.setInteractiveMouseEvents();
  };

  const handleMicrophoneMouseLeave = () => {
    console.log("Mouse left microphone button");
    window.electronAPI.setIgnoreMouseEvents();
  };

  return (
    <div className="select-none">
      <div className="pt-2 w-fit">
        <div className="text-xs text-foreground backdrop-blur-md bg-background/80 rounded-lg py-2 px-4 flex items-center justify-start gap-3">
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
            className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors cursor-pointer hover:bg-muted/50 bg-transparent border-0 text-foreground"
            onClick={handleMicrophoneClick}
            onMouseEnter={handleMicrophoneMouseEnter}
            onMouseLeave={handleMicrophoneMouseLeave}
            type="button"
            title={
              isRecording
                ? `Recording for ${formatElapsedTime(
                    recordingElapsedTime
                  )} - Click to stop`
                : "Start recording audio (system + microphone if available)"
            }
          >
            <span className="text-xs leading-none truncate">
              {isRecording ? formatElapsedTime(recordingElapsedTime) : "00:00"}
            </span>
            <div className="flex gap-1 flex-shrink-0">
              <MicrophoneIcon isRecording={isRecording} className="h-3 w-3" />
            </div>
          </button>

          <div className="mx-2 h-4 w-px bg-border" />

          <Tooltip
            onVisibilityChange={onTooltipVisibilityChange}
            trigger={<Settings className="h-4 w-4" />}
          />
        </div>
      </div>
    </div>
  );
}
