import { ChildProcess, spawn } from "child_process";

import { app } from "electron";
import fs from "node:fs";
import os from "os";
import path from "node:path";

export interface AudioRecording {
  filePath?: string; // Optional - only set when saved to disk for processing
  startTime: number;
  endTime?: number;
  duration?: number;
  audioBuffer?: Buffer; // Keep audio data in memory
  recordingMode?: "mixed" | "system-only" | "microphone-only"; // Track what was recorded
}

export class AudioHelper {
  private isRecording: boolean = false;
  private currentRecording: AudioRecording | null = null;
  private completedRecordings: AudioRecording[] = []; // Store completed recordings in memory
  private ffmpegProcess: ChildProcess | null = null;
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), "cass-audio");
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  private getSwiftHelperPath(): string {
    if (app.isPackaged) {
      // In packaged app, the helper should be in Resources
      return path.join(process.resourcesPath, "swift-helpers", "AudioMixer");
    } else {
      // In development, use from swift-helpers directory
      return path.join(process.cwd(), "swift-helpers", "AudioMixer");
    }
  }

  public async startRecording(): Promise<{ success: boolean; error?: string }> {
    if (this.isRecording) {
      return { success: false, error: "Recording already in progress" };
    }

    try {
      const timestamp = Date.now();

      this.currentRecording = {
        startTime: timestamp,
        };

      console.log("Attempting FFmpeg with system audio + microphone...");
      const ffmpegResult = await this.tryFFmpegMixedRecording();
      if (ffmpegResult.success) {
        return ffmpegResult;
      }

      console.log(
        "FFmpeg mixed recording failed, trying Swift microphone-only..."
      );

      const swiftResult = await this.trySwiftMicrophoneRecording();
      if (swiftResult.success) {
        return swiftResult;
      }

      console.log(
        "Swift microphone recording failed, falling back to system audio only..."
      );

      return await this.fallbackToSystemAudioOnly();
    } catch (error: any) {
      console.error("Error starting audio recording:", error);
      this.isRecording = false;
      this.currentRecording = null;
      return { success: false, error: error.message || String(error) };
    }
  }

  private async tryFFmpegMixedRecording(): Promise<{
    success: boolean;
    error?: string;
  }> {
    return new Promise((resolve) => {
      try {
        const ffmpegArgs = [
          "-f",
          "avfoundation",
          "-i",
          ":0",
          "-f",
          "avfoundation",
          "-i",
          ":1",
          "-filter_complex",
          "[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=0[out]",
          "-map",
          "[out]",
          "-ac",
          "1",
          "-ar",
          "16000",
          "-acodec",
          "pcm_s16le",
          "-f",
          "wav",
          "pipe:1",
        ];

        this.ffmpegProcess = spawn("ffmpeg", ffmpegArgs);

        const audioChunks: Buffer[] = [];
        let hasReceivedData = false;
        let hasError = false;

        this.ffmpegProcess.stdout?.on("data", (chunk: Buffer) => {
          audioChunks.push(chunk);
          hasReceivedData = true;

          if (this.currentRecording) {
            this.currentRecording.audioBuffer = Buffer.concat(audioChunks);
          }
        });

        this.ffmpegProcess.stderr?.on("data", (data: Buffer) => {
          const errorMessage = data.toString();
          console.error("FFmpeg mixed stderr:", errorMessage);

          if (
            errorMessage.includes("Input/output error") ||
            errorMessage.includes("Device or resource busy") ||
            errorMessage.includes("Permission denied") ||
            errorMessage.includes("No such device") ||
            errorMessage.includes("Invalid device")
          ) {
            console.log("Microphone access failed in mixed recording");
            hasError = true;
          }
        });

        this.ffmpegProcess.on("error", (error) => {
          console.error("FFmpeg mixed process error:", error);
          hasError = true;
          resolve({ success: false, error: error.message });
        });

        this.ffmpegProcess.on("exit", (code) => {
          console.log(`FFmpeg mixed process exited with code: ${code}`);
          if (this.currentRecording && !hasError && hasReceivedData) {
            this.currentRecording.endTime = Date.now();
            this.currentRecording.duration =
              this.currentRecording.endTime - this.currentRecording.startTime;
            this.currentRecording.audioBuffer = Buffer.concat(audioChunks);
            this.currentRecording.recordingMode = "mixed";
          }
        });

        setTimeout(() => {
          if (
            hasError ||
            (!hasReceivedData && this.ffmpegProcess?.exitCode !== null)
          ) {
            this.ffmpegProcess?.kill();
            this.ffmpegProcess = null;
            resolve({ success: false, error: "FFmpeg mixed recording failed" });
          } else if (hasReceivedData) {
            this.isRecording = true;
            if (this.currentRecording) {
              this.currentRecording.recordingMode = "mixed";
            }
            console.log("FFmpeg mixed recording started successfully");
            resolve({ success: true });
          }
        }, 2000); // Wait 2 seconds to see if it starts successfully
      } catch (error: any) {
        resolve({ success: false, error: error.message });
      }
    });
  }

  public async stopRecording(): Promise<{
    success: boolean;
    recording?: AudioRecording;
    error?: string;
  }> {
    if (!this.isRecording || !this.currentRecording) {
      return { success: false, error: "No recording in progress" };
    }

    try {
      if (this.ffmpegProcess) {
        this.ffmpegProcess.kill("SIGTERM");

        await new Promise<void>((resolve) => {
          if (this.ffmpegProcess) {
            this.ffmpegProcess.on("exit", () => resolve());
          } else {
            resolve();
          }
        });
      }

      const recording = this.currentRecording;
      recording.endTime = Date.now();
      recording.duration = recording.endTime - recording.startTime;

      this.completedRecordings.push({ ...recording });

      this.isRecording = false;
      this.ffmpegProcess = null;

      console.log("Audio recording stopped (kept in memory):", recording);

      return { success: true, recording };
    } catch (error: any) {
      console.error("Error stopping audio recording:", error);
      this.isRecording = false;
      this.currentRecording = null;
      this.ffmpegProcess = null;
      return { success: false, error: error.message };
    } finally {
      this.currentRecording = null;
    }
  }

  public getRecordingStatus(): {
    isRecording: boolean;
    recording?: AudioRecording;
  } {
    return {
      isRecording: this.isRecording,
      recording: this.currentRecording || undefined,
    };
  }

  public async getAudioBase64(filePath: string): Promise<string> {
    try {
      const audioData = fs.readFileSync(filePath);
      return audioData.toString("base64");
    } catch (error) {
      console.error("Error reading audio file:", error);
      throw error;
    }
  }

  public async saveCurrentRecordingForProcessing(): Promise<string | null> {
    if (this.isRecording && this.currentRecording) {
      console.log(
        "Capturing current audio data from in-progress recording (without stopping)"
      );

      try {
        const timestamp = this.currentRecording.startTime;
        const fileName = `recording-${timestamp}-partial.wav`;
        const filePath = path.join(this.tempDir, fileName);

        if (
          this.currentRecording.audioBuffer &&
          this.currentRecording.audioBuffer.length > 0
        ) {
          await fs.promises.writeFile(
            filePath,
            this.currentRecording.audioBuffer
          );
          console.log(
            "Saved current audio buffer for AI processing:",
            filePath
          );
          return filePath;
        } else {
          console.log("No audio data accumulated yet in current recording");
          return null;
        }
      } catch (error) {
        console.error(
          "Error handling in-progress recording for processing:",
          error
        );
        return null;
      }
    }

    const latestRecording =
      this.completedRecordings[this.completedRecordings.length - 1];

    if (!latestRecording || !latestRecording.audioBuffer) {
      console.log("No audio recording available for processing");
      return null;
    }

    try {
      const timestamp = latestRecording.startTime;
      const fileName = `recording-${timestamp}.wav`;
      const filePath = path.join(this.tempDir, fileName);

      if (latestRecording.filePath && fs.existsSync(latestRecording.filePath)) {
        console.log(
          "Audio recording already saved to disk:",
          latestRecording.filePath
        );
        return latestRecording.filePath;
      }

      await fs.promises.writeFile(filePath, latestRecording.audioBuffer);
      latestRecording.filePath = filePath;

      console.log("Audio recording saved to disk for processing:", filePath);
      return filePath;
    } catch (error) {
      console.error("Error saving recording for processing:", error);
      return null;
    }
  }

  public getLatestRecording(): AudioRecording | null {
    if (this.isRecording && this.currentRecording) {
      return this.currentRecording;
    }

    return this.completedRecordings.length > 0
      ? this.completedRecordings[this.completedRecordings.length - 1]
      : null;
  }

  public cleanupRecording(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("Cleaned up audio file:", filePath);
      }
    } catch (error) {
      console.error("Error cleaning up audio file:", error);
    }
  }

  public cleanupAllRecordings(): void {
    try {
      if (this.isRecording && this.ffmpegProcess) {
        this.ffmpegProcess.kill("SIGTERM");
        this.isRecording = false;
        this.currentRecording = null;
        this.ffmpegProcess = null;
      }

      this.completedRecordings = [];

      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        files.forEach((file) => {
          const filePath = path.join(this.tempDir, file);
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            console.error(`Error deleting audio file ${filePath}:`, error);
          }
        });

        try {
          fs.rmdirSync(this.tempDir);
        } catch (error) {
        }

        console.log("Cleaned up all audio recordings and temporary files");
      }
    } catch (error) {
      console.error("Error cleaning up all recordings:", error);
    }
  }

  private async fallbackToSystemAudioOnly(): Promise<{
    success: boolean;
    error?: string;
  }> {
    console.log("Falling back to system audio only recording...");

    try {
      if (this.ffmpegProcess) {
        this.ffmpegProcess.kill();
        this.ffmpegProcess = null;
      }

      const fallbackArgs = [
        "-f",
        "avfoundation",
        "-i",
        ":1", // System audio output (what's playing through speakers)
        "-ac",
        "1", // Mono output (better for speech recognition)
        "-ar",
        "16000", // 16kHz sample rate (optimal for speech AI)
        "-acodec",
        "pcm_s16le", // Linear PCM encoding
        "-f",
        "wav", // Output format
        "pipe:1", // Output to stdout instead of file
      ];

      this.ffmpegProcess = spawn("ffmpeg", fallbackArgs);

      // Collect audio data in memory
      const audioChunks: Buffer[] = [];

      this.ffmpegProcess.stdout?.on("data", (chunk: Buffer) => {
        audioChunks.push(chunk);

        // Update current recording buffer in real-time for AI processing
        if (this.currentRecording) {
          this.currentRecording.audioBuffer = Buffer.concat(audioChunks);
        }
      });

      this.ffmpegProcess.stderr?.on("data", (data: Buffer) => {
        console.error("FFmpeg fallback stderr:", data.toString());
      });

      this.ffmpegProcess.on("error", (error) => {
        console.error("FFmpeg fallback process error:", error);
        this.isRecording = false;
        this.currentRecording = null;
      });

      this.ffmpegProcess.on("exit", (code) => {
        console.log(`FFmpeg fallback process exited with code: ${code}`);
        if (this.currentRecording) {
          this.currentRecording.endTime = Date.now();
          this.currentRecording.duration =
            this.currentRecording.endTime - this.currentRecording.startTime;
          // Store audio data in memory
          this.currentRecording.audioBuffer = Buffer.concat(audioChunks);
          this.currentRecording.recordingMode = "system-only";
        }
      });

      this.isRecording = true;
      if (this.currentRecording) {
        this.currentRecording.recordingMode = "system-only";
      }
      console.log(
        "Audio recording started (system audio only fallback, in memory)"
      );

      return { success: true };
    } catch (error: any) {
      console.error("Error in fallback recording:", error);
      this.isRecording = false;
      this.currentRecording = null;
      return { success: false, error: error.message || String(error) };
    }
  }

  private async trySwiftMicrophoneRecording(): Promise<{
    success: boolean;
    error?: string;
  }> {
    console.log("Attempting Swift-based microphone recording...");

    try {
      const timestamp = Date.now();
      const fileName = `recording-${timestamp}.wav`;
      const filePath = path.join(this.tempDir, fileName);

      // Path to the built Swift audio mixer
      const swiftHelperPath = this.getSwiftHelperPath();

      if (!fs.existsSync(swiftHelperPath)) {
        console.error("Swift audio mixer not found at:", swiftHelperPath);
        return { success: false, error: "Swift audio mixer not available" };
      }

      this.currentRecording = {
        startTime: timestamp,
        recordingMode: "microphone-only",
        filePath: filePath,
      };

      this.ffmpegProcess = spawn(swiftHelperPath, [filePath]);

      this.ffmpegProcess.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        console.log("Swift audio mixer output:", output);

        if (output.includes("READY")) {
          console.log("Swift audio mixer is ready and recording");
        }
      });

      this.ffmpegProcess.stderr?.on("data", (data: Buffer) => {
        console.error("Swift audio mixer stderr:", data.toString());
      });

      this.ffmpegProcess.on("error", (error) => {
        console.error("Swift audio mixer process error:", error);
        this.isRecording = false;
        this.currentRecording = null;
      });

      this.ffmpegProcess.on("exit", (code) => {
        console.log(`Swift audio mixer process exited with code: ${code}`);
        if (this.currentRecording && fs.existsSync(filePath)) {
          this.currentRecording.endTime = Date.now();
          this.currentRecording.duration =
            this.currentRecording.endTime - this.currentRecording.startTime;

          try {
            this.currentRecording.audioBuffer = fs.readFileSync(filePath);
            console.log("Swift audio recording file read into memory");
          } catch (error) {
            console.error("Error reading Swift audio file:", error);
          }
        }
      });

      this.isRecording = true;
      console.log("Swift microphone recording started");

      return { success: true };
    } catch (error: any) {
      console.error("Error starting Swift microphone recording:", error);
      this.isRecording = false;
      this.currentRecording = null;
      return { success: false, error: error.message || String(error) };
    }
  }
}
