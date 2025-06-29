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

  const statusCheckControl = useRef({
    skipStatusChecks: false,
    lastUserInteraction: 0,
  });

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

  useEffect(() => {
    let consecutiveStoppedChecks = 0;
    const REQUIRED_STOPPED_CHECKS = 2;

    const checkRecordingStatus = async () => {
      try {
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

          if (!result.isRecording && wasRecording) {
            consecutiveStoppedChecks++;

            if (consecutiveStoppedChecks >= REQUIRED_STOPPED_CHECKS) {
              setIsRecording(false);
              setRecordingStartTime(null);
              setRecordingElapsedTime(0);
              consecutiveStoppedChecks = 0;
            }
          } else if (result.isRecording) {
            consecutiveStoppedChecks = 0;
            if (!wasRecording) {
              const timeSinceLastInteraction =
                Date.now() - statusCheckControl.current.lastUserInteraction;
              if (timeSinceLastInteraction > 3000) {
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

    const markUserInteraction = () => {
      statusCheckControl.current.lastUserInteraction = Date.now();
    };

    checkRecordingStatus();
    const interval = setInterval(checkRecordingStatus, 500);

    return () => {
      clearInterval(interval);
    };
  }, [isRecording, recordingStartTime]);

  useEffect(() => {
    if (isRecording && recordingStartTime) {
      const updateElapsedTime = () => {
        const elapsed = Date.now() - recordingStartTime;
        setRecordingElapsedTime(elapsed);

        if (elapsed >= MAX_RECORDING_TIME) {
          handleStopRecording();
        }
      };

      updateElapsedTime();
      const interval = setInterval(updateElapsedTime, 100);
      return () => clearInterval(interval);
    }
  }, [isRecording, recordingStartTime]);

  const handleStopRecording = async () => {
    try {
      const result = await window.electronAPI.stopAudioRecording();
      if (result.success) {
      } else {
        console.error("Failed to stop recording:", result.error);
        setIsRecording(true);
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

    statusCheckControl.current.skipStatusChecks = true;
    statusCheckControl.current.lastUserInteraction = Date.now();

    try {
      if (isRecording) {
        setIsRecording(false);
        setRecordingStartTime(null);
        setRecordingElapsedTime(0);
        await handleStopRecording();
      } else {
        const startTime = Date.now();
        setIsRecording(true);
        setRecordingStartTime(startTime);
        setRecordingElapsedTime(0);

        const result = await window.electronAPI.startAudioRecording();
        if (!result.success) {
          setIsRecording(false);
          setRecordingStartTime(null);
          setRecordingElapsedTime(0);
          console.error("Failed to start recording:", result.error);
        } else {
        }
      }
    } catch (error) {
      setIsRecording(false);
      setRecordingStartTime(null);
      setRecordingElapsedTime(0);
      console.error("Error toggling audio recording:", error);
    } finally {
      setTimeout(() => {
        statusCheckControl.current.skipStatusChecks = false;
      }, 3000);
    }
  };

  const handleMicrophoneMouseEnter = () => {
    window.electronAPI.setInteractiveMouseEvents();
  };

  const handleMicrophoneMouseLeave = () => {
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
