import { BrowserWindow, app } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Import node-record-lpcm16 for Node.js-based microphone recording
let record: any = null;
try {
  record = require("node-record-lpcm16");
} catch (error) {
  console.log("node-record-lpcm16 not available, will use FFmpeg or mock recording");
}

// Note: Windows audio recording uses mock recording for compatibility
// Real audio recording requires external tools like SoX which aren't available by default

export interface AudioRecording {
  filePath?: string; // Optional - only set when saved to disk for processing
  startTime: number;
  endTime?: number;
  duration?: number;
  audioBuffer?: Buffer; // Keep audio data in memory
  recordingMode?: "mixed" | "system-only" | "microphone-only" | "mock"; // Track what was recorded
}

export class AudioHelper {
  private isRecording: boolean = false;
  private currentRecording: AudioRecording | null = null;
  private completedRecordings: AudioRecording[] = []; // Store completed recordings in memory
  private ffmpegProcess: ChildProcess | null = null;
  private tempDir: string;
  private mainWindow: BrowserWindow | null = null;
  private mockRecordingInterval: NodeJS.Timeout | null = null;

  constructor(mainWindow?: BrowserWindow | null) {
    this.tempDir = path.join(os.tmpdir(), "cass-audio");
    this.mainWindow = mainWindow || null;
    this.ensureTempDir();
  }

  public setMainWindow(mainWindow: BrowserWindow | null) {
    this.mainWindow = mainWindow;
  }

  private emitRecordingStatusChange() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("audio-recording-status-changed", {
        isRecording: this.isRecording,
        recording: this.currentRecording,
        recordingMode: this.currentRecording?.recordingMode,
      });
    }
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
      this.ensureTempDir();
      this.isRecording = true;
      this.currentRecording = {
        startTime: Date.now(),
        recordingMode: "mock",
      };

      this.emitRecordingStatusChange();

      // Test if FFmpeg is available
      try {
        const { exec } = require('child_process');
        exec('ffmpeg -version', (error: any, stdout: any, stderr: any) => {
          if (error) {
            console.error("❌ FFmpeg not found:", error.message);
            console.log("⚠️  Please install FFmpeg to enable real microphone recording");
          } else {
            console.log("✅ FFmpeg is available");
          }
        });
      } catch (error) {
        console.error("❌ Cannot check FFmpeg:", error);
      }

      // Check platform and try appropriate recording method
      if (process.platform === "win32") {
        console.log("Windows detected, attempting microphone recording...");
        const ffmpegResult = await this.tryFFmpegMixedRecording();
        if (ffmpegResult.success) {
          console.log("✅ FFmpeg recording succeeded - using real microphone");
          return ffmpegResult;
        }

        console.log("❌ FFmpeg recording failed, trying Windows microphone-only...");
        const windowsMicResult = await this.tryWindowsMicrophoneRecording();
        if (windowsMicResult.success) {
          console.log("✅ Windows microphone recording succeeded - using real microphone");
          return windowsMicResult;
        }

        console.log("❌ Windows microphone recording failed, trying Node.js microphone recording...");
        const nodeMicResult = await this.tryNodeMicrophoneRecording();
        if (nodeMicResult.success) {
          console.log("✅ Node.js microphone recording succeeded - using real microphone");
          return nodeMicResult;
        }

        console.log("❌ Node.js microphone recording failed, falling back to mock recording...");
        console.log("⚠️  WARNING: Using mock recording - no real microphone input");
        return await this.tryMockRecording();
      } else if (process.platform === "darwin") {
        console.log("macOS detected, attempting microphone recording...");
        const swiftResult = await this.trySwiftMicrophoneRecording();
        if (swiftResult.success) {
          return swiftResult;
        }

        console.log("Swift recording failed, trying FFmpeg mixed recording...");
        const ffmpegResult = await this.tryFFmpegMixedRecording();
        if (ffmpegResult.success) {
          return ffmpegResult;
        }

        console.log("FFmpeg recording failed, falling back to system audio only...");
        return await this.fallbackToSystemAudioOnly();
      } else {
        console.log("Linux detected, attempting FFmpeg mixed recording...");
        const ffmpegResult = await this.tryFFmpegMixedRecording();
        if (ffmpegResult.success) {
          return ffmpegResult;
        }

        console.log("FFmpeg recording failed, falling back to mock recording...");
        return await this.tryMockRecording();
      }
    } catch (error: any) {
      console.error("Error starting recording:", error);
      this.isRecording = false;
      this.currentRecording = null;
      this.emitRecordingStatusChange();
      return { success: false, error: error.message };
    }
  }



  private async tryMockRecording(): Promise<{
    success: boolean;
    error?: string;
  }> {
    return new Promise((resolve) => {
      try {
        console.log("Starting mock audio recording for testing...");
        
        this.isRecording = true;
        if (this.currentRecording) {
          this.currentRecording.recordingMode = "mock";
        }
        
        // Create a proper WAV file buffer (simulated audio)
        const sampleRate = 16000;
        const duration = 3000; // 3 seconds for a more substantial recording
        const samples = sampleRate * duration / 1000;
        const mockWavBuffer = this.createMockSpeechAudio(samples, sampleRate);
        
        // Validate the WAV file
        if (!this.validateWavFile(mockWavBuffer)) {
          console.error("Failed to create valid WAV file for mock recording");
          resolve({ success: false, error: "Failed to create valid audio file" });
          return;
        }
        
        if (this.currentRecording) {
          this.currentRecording.audioBuffer = mockWavBuffer;
        }
        
        this.emitRecordingStatusChange();
        
        // Set up interval to simulate ongoing recording
        this.mockRecordingInterval = setInterval(() => {
          if (this.currentRecording && this.isRecording) {
            // Create a longer WAV file to simulate longer recording
            const longerSamples = sampleRate * 5; // 5 seconds
            const newWavBuffer = this.createMockSpeechAudio(longerSamples, sampleRate);
            this.currentRecording.audioBuffer = newWavBuffer;
          }
        }, 3000); // Update every 3 seconds
        
        console.log("Mock recording started successfully (simulating audio input for testing)");
        resolve({ success: true });
      } catch (error: any) {
        resolve({ success: false, error: error.message });
      }
    });
  }

  private createWavBuffer(samples: number, sampleRate: number): Buffer {
    // Create a proper WAV file header and data
    const dataSize = samples * 2; // 16-bit samples
    const fileSize = 36 + dataSize;
    
    const buffer = Buffer.alloc(44 + dataSize); // WAV header (44 bytes) + data
    
    // WAV file header
    let offset = 0;
    
    // RIFF header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;
    
    // fmt chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // fmt chunk size
    buffer.writeUInt16LE(1, offset); offset += 2; // PCM format
    buffer.writeUInt16LE(1, offset); offset += 2; // mono
    buffer.writeUInt32LE(sampleRate, offset); offset += 4; // sample rate
    buffer.writeUInt32LE(sampleRate * 2, offset); offset += 4; // byte rate
    buffer.writeUInt16LE(2, offset); offset += 2; // block align
    buffer.writeUInt16LE(16, offset); offset += 2; // bits per sample
    
    // data chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;
    
    // Fill with more substantial audio content that Whisper will recognize
    for (let i = 0; i < samples; i++) {
      // Create a more complex waveform that simulates speech-like patterns
      const time = i / sampleRate;
      const frequency1 = 200; // Base frequency
      const frequency2 = 400; // Higher frequency
      const frequency3 = 600; // Even higher frequency
      
      // Combine multiple frequencies to create more realistic audio
      const value1 = Math.sin(2 * Math.PI * frequency1 * time) * 2000;
      const value2 = Math.sin(2 * Math.PI * frequency2 * time) * 1000;
      const value3 = Math.sin(2 * Math.PI * frequency3 * time) * 500;
      
      // Add some variation to make it more speech-like
      const envelope = Math.sin(time * 2) * 0.5 + 0.5; // Amplitude envelope
      const combinedValue = (value1 + value2 + value3) * envelope;
      
      // Clamp to 16-bit range
      const clampedValue = Math.max(-32768, Math.min(32767, Math.floor(combinedValue)));
      buffer.writeInt16LE(clampedValue, offset + i * 2);
    }
    
    console.log(`Created WAV file: ${samples} samples, ${sampleRate}Hz, ${buffer.length} bytes`);
    return buffer;
  }

  private createSpeechLikeAudio(samples: number, sampleRate: number): Buffer {
    // Create a proper WAV file header and data
    const dataSize = samples * 2; // 16-bit samples
    const fileSize = 36 + dataSize;
    
    const buffer = Buffer.alloc(44 + dataSize); // WAV header (44 bytes) + data
    
    // WAV file header
    let offset = 0;
    
    // RIFF header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;
    
    // fmt chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // fmt chunk size
    buffer.writeUInt16LE(1, offset); offset += 2; // PCM format
    buffer.writeUInt16LE(1, offset); offset += 2; // mono
    buffer.writeUInt32LE(sampleRate, offset); offset += 4; // sample rate
    buffer.writeUInt32LE(sampleRate * 2, offset); offset += 4; // byte rate
    buffer.writeUInt16LE(2, offset); offset += 2; // block align
    buffer.writeUInt16LE(16, offset); offset += 2; // bits per sample
    
    // data chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;
    
    // Create speech-like audio with varying frequencies and amplitudes
    for (let i = 0; i < samples; i++) {
      const time = i / sampleRate;
      
      // Create varying speech-like frequencies
      const baseFreq = 150 + Math.sin(time * 0.5) * 50; // Varying base frequency
      const formant1 = 800 + Math.sin(time * 0.3) * 200; // First formant
      const formant2 = 1200 + Math.sin(time * 0.7) * 300; // Second formant
      
      // Combine frequencies to simulate speech
      const value1 = Math.sin(2 * Math.PI * baseFreq * time) * 3000;
      const value2 = Math.sin(2 * Math.PI * formant1 * time) * 1500;
      const value3 = Math.sin(2 * Math.PI * formant2 * time) * 800;
      
      // Add amplitude modulation to simulate speech patterns
      const amplitudeMod = Math.sin(time * 4) * 0.3 + 0.7;
      const combinedValue = (value1 + value2 + value3) * amplitudeMod;
      
      // Add some noise to make it more realistic
      const noise = (Math.random() - 0.5) * 500;
      const finalValue = combinedValue + noise;
      
      // Clamp to 16-bit range
      const clampedValue = Math.max(-32768, Math.min(32767, Math.floor(finalValue)));
      buffer.writeInt16LE(clampedValue, offset + i * 2);
    }
    
    console.log(`Created speech-like WAV file: ${samples} samples, ${sampleRate}Hz, ${buffer.length} bytes`);
    return buffer;
  }

  private createMockSpeechAudio(samples: number, sampleRate: number): Buffer {
    // Create a proper WAV file header and data
    const dataSize = samples * 2; // 16-bit samples
    const fileSize = 36 + dataSize;
    
    const buffer = Buffer.alloc(44 + dataSize); // WAV header (44 bytes) + data
    
    // WAV file header
    let offset = 0;
    
    // RIFF header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;
    
    // fmt chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // fmt chunk size
    buffer.writeUInt16LE(1, offset); offset += 2; // PCM format
    buffer.writeUInt16LE(1, offset); offset += 2; // mono
    buffer.writeUInt32LE(sampleRate, offset); offset += 4; // sample rate
    buffer.writeUInt32LE(sampleRate * 2, offset); offset += 4; // byte rate
    buffer.writeUInt16LE(2, offset); offset += 2; // block align
    buffer.writeUInt16LE(16, offset); offset += 2; // bits per sample
    
    // data chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;
    
    // Create a simple but clear audio pattern
    for (let i = 0; i < samples; i++) {
      const time = i / sampleRate;
      
      // Create a clear tone with distinct amplitude
      const frequency = 300; // Clear, audible frequency
      const amplitude = 16000; // High amplitude to ensure it's detected
      
      // Create a simple sine wave with clear amplitude
      const value = Math.sin(2 * Math.PI * frequency * time) * amplitude;
      
      // Add clear amplitude modulation to create distinct patterns
      const modulation = Math.sin(time * 4) * 0.5 + 0.5; // Clear modulation pattern
      const finalValue = value * modulation;
      
      // Clamp to 16-bit range
      const clampedValue = Math.max(-32768, Math.min(32767, Math.floor(finalValue)));
      buffer.writeInt16LE(clampedValue, offset + i * 2);
    }
    
    console.log(`Created mock speech WAV file: ${samples} samples, ${sampleRate}Hz, ${buffer.length} bytes`);
    return buffer;
  }

  private validateWavFile(buffer: Buffer): boolean {
    try {
      // Check RIFF header
      if (buffer.toString('ascii', 0, 4) !== 'RIFF') {
        console.error('Invalid WAV file: missing RIFF header');
        return false;
      }
      
      // Check WAVE identifier
      if (buffer.toString('ascii', 8, 12) !== 'WAVE') {
        console.error('Invalid WAV file: missing WAVE identifier');
        return false;
      }
      
      // Check fmt chunk
      if (buffer.toString('ascii', 12, 16) !== 'fmt ') {
        console.error('Invalid WAV file: missing fmt chunk');
        return false;
      }
      
      // Check data chunk
      if (buffer.toString('ascii', 36, 40) !== 'data') {
        console.error('Invalid WAV file: missing data chunk');
        return false;
      }
      
      console.log('WAV file validation passed');
      return true;
    } catch (error) {
      console.error('Error validating WAV file:', error);
      return false;
    }
  }

  private async tryFFmpegMixedRecording(): Promise<{
    success: boolean;
    error?: string;
  }> {
    return new Promise((resolve) => {
      try {
        let ffmpegArgs: string[];
        
        if (process.platform === "win32") {
          // Windows: Use DirectShow for microphone recording with better quality
          ffmpegArgs = [
            "-f",
            "dshow",
            "-i",
            "audio=Microphone",
            "-ac",
            "1", // Mono
            "-ar",
            "44100", // Higher sample rate for better quality
            "-acodec",
            "pcm_s16le",
            "-af",
            "highpass=f=200,lowpass=f=3000,volume=2.0", // Audio filters for better speech
            "-f",
            "wav",
            "-threads",
            "2",
            "pipe:1",
          ];
        } else {
          // macOS: Use avfoundation for mixed recording
          ffmpegArgs = [
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
            "44100", // Higher sample rate for better quality
            "-acodec",
            "pcm_s16le",
            "-af",
            "highpass=f=200,lowpass=f=3000,volume=2.0", // Audio filters for better speech
            "-f",
            "wav",
            "-threads",
            process.platform === "darwin" ? "4" : "2",
            "pipe:1",
          ];
        }

        this.ffmpegProcess = spawn("ffmpeg", ffmpegArgs);

        const audioChunks: Buffer[] = [];
        let hasReceivedData = false;
        let hasError = false;

        this.ffmpegProcess.stdout?.on("data", (chunk: Buffer) => {
          audioChunks.push(chunk);
          if (!hasReceivedData) {
            hasReceivedData = true;
            // Only set recording state when we actually receive audio data
            this.isRecording = true;
            if (this.currentRecording) {
              this.currentRecording.recordingMode = process.platform === "win32" ? "microphone-only" : "mixed";
            }
            console.log("FFmpeg recording started successfully");
            console.log("✅ Receiving real audio data from microphone");
            this.emitRecordingStatusChange();
          }

          if (this.currentRecording) {
            this.currentRecording.audioBuffer = Buffer.concat(audioChunks);
            console.log("Audio buffer size:", this.currentRecording.audioBuffer.length, "bytes");
          }
        });

        this.ffmpegProcess.stderr?.on("data", (data: Buffer) => {
          const errorMessage = data.toString();
          console.error("FFmpeg stderr:", errorMessage);

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
          console.error("FFmpeg process error:", error);
          hasError = true;
          resolve({ success: false, error: error.message });
        });

        this.ffmpegProcess.on("exit", (code) => {
          console.log(`FFmpeg process exited with code: ${code}`);
          if (this.currentRecording && !hasError && hasReceivedData) {
            this.currentRecording.endTime = Date.now();
            this.currentRecording.duration =
              this.currentRecording.endTime - this.currentRecording.startTime;
            this.currentRecording.audioBuffer = Buffer.concat(audioChunks);
            this.currentRecording.recordingMode = process.platform === "win32" ? "microphone-only" : "mixed";
          }
        });

        setTimeout(() => {
          if (
            hasError ||
            (!hasReceivedData && this.ffmpegProcess?.exitCode !== null)
          ) {
            this.ffmpegProcess?.kill();
            this.ffmpegProcess = null;
            resolve({ success: false, error: "FFmpeg recording failed" });
          } else if (hasReceivedData) {
            console.log("FFmpeg recording confirmed working");
            resolve({ success: true });
          } else {
            console.log("FFmpeg recording still starting...");
            resolve({ success: true });
          }
        }, 2000);
      } catch (error: any) {
        console.error("Error in FFmpeg mixed recording:", error);
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
      // Stop mock recording interval if running
      if (this.mockRecordingInterval) {
        clearInterval(this.mockRecordingInterval);
        this.mockRecordingInterval = null;
      }

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

      console.log("About to add recording to completedRecordings:", {
        startTime: recording.startTime,
        endTime: recording.endTime,
        duration: recording.duration,
        audioBufferSize: recording.audioBuffer?.length || 0,
        recordingMode: recording.recordingMode
      });

      this.completedRecordings.push({ ...recording });

      console.log("Completed recordings array length:", this.completedRecordings.length);
      console.log("Recording mode used:", recording.recordingMode);
      console.log("Audio buffer size:", recording.audioBuffer?.length || 0, "bytes");
      console.log("Recording duration:", recording.duration, "ms");

      this.isRecording = false;
      this.ffmpegProcess = null;

      console.log("Audio recording stopped (kept in memory):", recording);
      this.emitRecordingStatusChange();

      return { success: true, recording };
    } catch (error: any) {
      console.error("Error stopping audio recording:", error);
      this.isRecording = false;
      this.currentRecording = null;
      this.ffmpegProcess = null;
      this.mockRecordingInterval = null;
      this.emitRecordingStatusChange();
      return { success: false, error: error.message };
    } finally {
      console.log("Setting currentRecording to null in finally block");
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
    console.log("saveCurrentRecordingForProcessing called");
    console.log("isRecording:", this.isRecording);
    console.log("currentRecording:", this.currentRecording ? "exists" : "null");
    console.log("completedRecordings length:", this.completedRecordings.length);

    if (this.isRecording && this.currentRecording) {
      console.log(
        "Capturing current audio data from in-progress recording (without stopping)"
      );

      try {
        const timestamp = this.currentRecording.startTime;
        const fileName = `recording-${timestamp}-partial.webm`;
        const filePath = path.join(this.tempDir, fileName);

        if (
          this.currentRecording.audioBuffer &&
          this.currentRecording.audioBuffer.length > 0
        ) {
          console.log("Current recording has audio buffer, size:", this.currentRecording.audioBuffer.length);
          
          // Save WebM audio directly without WAV validation
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

    console.log("Latest recording from completedRecordings:", latestRecording ? "exists" : "null");

    if (!latestRecording || !latestRecording.audioBuffer) {
      console.log("No audio recording available for processing");
      return null;
    }

    console.log("Latest recording has audio buffer, size:", latestRecording.audioBuffer.length);

    try {
      const timestamp = latestRecording.startTime;
      const fileName = `recording-${timestamp}.webm`;
      const filePath = path.join(this.tempDir, fileName);

      if (latestRecording.filePath && fs.existsSync(latestRecording.filePath)) {
        console.log(
          "Audio recording already saved to disk:",
          latestRecording.filePath
        );
        return latestRecording.filePath;
      }

      // Save WebM audio directly without WAV validation
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
    console.log("getLatestRecording called");
    console.log("isRecording:", this.isRecording);
    console.log("currentRecording:", this.currentRecording ? "exists" : "null");
    console.log("completedRecordings length:", this.completedRecordings.length);
    
    if (this.isRecording && this.currentRecording) {
      console.log("Returning current recording");
      return this.currentRecording;
    }

    const latestCompleted = this.completedRecordings.length > 0
      ? this.completedRecordings[this.completedRecordings.length - 1]
      : null;
      
    console.log("Latest completed recording:", latestCompleted ? "exists" : "null");
    return latestCompleted;
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
        this.emitRecordingStatusChange();
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
        } catch (error) {}

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
        "-threads",
        process.platform === "darwin" ? "4" : "2", // Optimize for Mac M2
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
        this.emitRecordingStatusChange();
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
      this.emitRecordingStatusChange();

      return { success: true };
    } catch (error: any) {
      console.error("Error in fallback recording:", error);
      this.isRecording = false;
      this.currentRecording = null;
      this.emitRecordingStatusChange();
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
        this.emitRecordingStatusChange();
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
      this.emitRecordingStatusChange();

      return { success: true };
    } catch (error: any) {
      console.error("Error starting Swift microphone recording:", error);
      this.isRecording = false;
      this.currentRecording = null;
      this.emitRecordingStatusChange();
      return { success: false, error: error.message || String(error) };
    }
  }

  private async tryWindowsMicrophoneRecording(): Promise<{
    success: boolean;
    error?: string;
  }> {
    return new Promise((resolve) => {
      try {
        console.log("Attempting Windows microphone recording...");
        
        const ffmpegArgs = [
          "-f",
          "dshow",
          "-i",
          "audio=Microphone",
          "-ac",
          "1", // Mono
          "-ar",
          "44100", // Higher sample rate for better quality
          "-acodec",
          "pcm_s16le",
          "-af",
          "highpass=f=200,lowpass=f=3000,volume=2.0", // Audio filters for better speech
          "-f",
          "wav",
          "-threads",
          "2",
          "pipe:1",
        ];

        this.ffmpegProcess = spawn("ffmpeg", ffmpegArgs);
        const audioChunks: Buffer[] = [];
        let hasReceivedData = false;
        let hasError = false;

        this.ffmpegProcess.stdout?.on("data", (chunk: Buffer) => {
          audioChunks.push(chunk);
          if (!hasReceivedData) {
            hasReceivedData = true;
            this.isRecording = true;
            if (this.currentRecording) {
              this.currentRecording.recordingMode = "microphone-only";
            }
            console.log("Windows microphone recording started successfully");
            console.log("✅ Receiving real audio data from Windows microphone");
            this.emitRecordingStatusChange();
          }

          if (this.currentRecording) {
            this.currentRecording.audioBuffer = Buffer.concat(audioChunks);
            console.log("Audio buffer size:", this.currentRecording.audioBuffer.length, "bytes");
          }
        });

        this.ffmpegProcess.stderr?.on("data", (data: Buffer) => {
          const errorMessage = data.toString();
          if (
            errorMessage.includes("Permission denied") ||
            errorMessage.includes("No such device") ||
            errorMessage.includes("Invalid device") ||
            errorMessage.includes("DirectShow") ||
            errorMessage.includes("dshow")
          ) {
            console.log("Microphone access failed in Windows recording");
            hasError = true;
          }
        });

        this.ffmpegProcess.on("error", (error) => {
          console.error("FFmpeg Windows microphone recording error:", error);
          hasError = true;
        });

        this.ffmpegProcess.on("exit", (code) => {
          if (this.currentRecording && hasReceivedData) {
            this.currentRecording.endTime = Date.now();
            this.currentRecording.duration =
              this.currentRecording.endTime - this.currentRecording.startTime;
            this.currentRecording.audioBuffer = Buffer.concat(audioChunks);
            this.currentRecording.recordingMode = "microphone-only";
          }
        });

        setTimeout(() => {
          if (hasError || !hasReceivedData) {
            this.ffmpegProcess?.kill();
            this.ffmpegProcess = null;
            resolve({ success: false, error: "Failed to start Windows microphone recording" });
          } else if (hasReceivedData) {
            console.log("Windows microphone recording confirmed working");
            resolve({ success: true });
          } else {
            console.log("Windows microphone recording still starting...");
            resolve({ success: true });
          }
        }, 2000);
      } catch (error: any) {
        console.error("Error in Windows microphone recording:", error);
        resolve({ success: false, error: error.message });
      }
    });
  }

  private async tryNodeMicrophoneRecording(): Promise<{
    success: boolean;
    error?: string;
  }> {
    return new Promise((resolve) => {
      try {
        console.log("Attempting pure Node.js microphone recording...");
        
        // Use Electron's webContents to access microphone through Web Audio API
        const mainWindow = this.mainWindow;
        if (!mainWindow) {
          resolve({ success: false, error: "Main window not available" });
          return;
        }

        // Reset audio chunks for new recording
        const audioChunks: Buffer[] = [];
        let hasReceivedData = false;
        let hasError = false;
        let recordingTimeout: NodeJS.Timeout | null = null;

        // Send a message to the renderer process to start recording
        mainWindow.webContents.send('start-microphone-recording');
        
        // Listen for audio data from the renderer process
        const handleAudioData = (event: any, audioData: any) => {
          if (audioData && audioData.buffer) {
            const buffer = Buffer.from(audioData.buffer);
            audioChunks.push(buffer);
            
            if (!hasReceivedData) {
              hasReceivedData = true;
              this.isRecording = true;
              if (this.currentRecording) {
                this.currentRecording.recordingMode = "microphone-only";
              }
              console.log("✅ Pure Node.js microphone recording started successfully");
              console.log("✅ Receiving real audio data from microphone");
              console.log("📊 Audio quality settings: 16kHz, mono, noise suppression enabled");
              this.emitRecordingStatusChange();
            }

            if (this.currentRecording) {
              this.currentRecording.audioBuffer = Buffer.concat(audioChunks);
              console.log("Audio buffer size:", this.currentRecording.audioBuffer.length, "bytes");
            }
            
            // If this is the final chunk, process the complete audio
            if (audioData.isFinal && this.currentRecording) {
              console.log("Processing final audio chunk for transcription");
              const completeAudioBuffer = Buffer.concat(audioChunks);
              this.currentRecording.audioBuffer = completeAudioBuffer;
              console.log("Complete audio buffer size:", completeAudioBuffer.length, "bytes");
              console.log("🎤 Recording quality: High-quality WebM audio ready for Whisper");
            }
          }
        };

        // Listen for recording completion
        const handleRecordingComplete = (event: any, finalData: any) => {
          if (recordingTimeout) {
            clearTimeout(recordingTimeout);
            recordingTimeout = null;
          }
          
          if (this.currentRecording && hasReceivedData) {
            this.currentRecording.endTime = Date.now();
            this.currentRecording.duration =
              this.currentRecording.endTime - this.currentRecording.startTime;
            
            // Use WebM audio directly for Whisper
            const audioBuffer = Buffer.concat(audioChunks);
            this.currentRecording.audioBuffer = audioBuffer;
            this.currentRecording.recordingMode = "microphone-only";
            
            console.log("Pure Node.js recording completed:", {
              duration: this.currentRecording.duration,
              audioSize: audioBuffer.length,
              format: "WebM"
            });
          }
        };

        // Listen for recording error
        const handleRecordingError = (event: any, error: any) => {
          console.error("Pure Node.js microphone recording error:", error);
          hasError = true;
          if (recordingTimeout) {
            clearTimeout(recordingTimeout);
            recordingTimeout = null;
          }
        };

        // Set up IPC listeners
        const handleIpcMessage = (event: any, channel: string, ...args: any[]) => {
          if (channel === 'audio-data') {
            handleAudioData(event, args[0]);
          } else if (channel === 'recording-complete') {
            handleRecordingComplete(event, args[0]);
          } else if (channel === 'recording-error') {
            handleRecordingError(event, args[0]);
          }
        };

        // Remove any existing listeners and add new ones
        mainWindow.webContents.removeAllListeners('ipc-message');
        mainWindow.webContents.on('ipc-message', handleIpcMessage);

        // Set a timeout to check if recording started
        recordingTimeout = setTimeout(() => {
          if (hasError || !hasReceivedData) {
            resolve({ success: false, error: "Failed to start pure Node.js microphone recording" });
          } else if (hasReceivedData) {
            console.log("Pure Node.js microphone recording confirmed working");
            resolve({ success: true });
          } else {
            console.log("Pure Node.js microphone recording still starting...");
            resolve({ success: true });
          }
        }, 3000);
      } catch (error: any) {
        console.error("Error in pure Node.js microphone recording:", error);
        resolve({ success: false, error: error.message });
      }
    });
  }

  private convertWebmToWav(webmBuffer: Buffer, sampleRate: number = 16000): Buffer {
    // For now, we'll save the WebM audio directly since Whisper can handle it
    // In a production environment, you might want to convert to WAV using ffmpeg
    console.log(`Using WebM audio directly: ${webmBuffer.length} bytes`);
    return webmBuffer;
  }

  private convertPcmToWav(pcmBuffer: Buffer, sampleRate: number = 16000): Buffer {
    // Create WAV file header
    const dataSize = pcmBuffer.length;
    const fileSize = 36 + dataSize;
    
    const buffer = Buffer.alloc(44 + dataSize); // WAV header (44 bytes) + data
    let offset = 0;
    
    // RIFF header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;
    
    // fmt chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // fmt chunk size
    buffer.writeUInt16LE(1, offset); offset += 2; // PCM format
    buffer.writeUInt16LE(1, offset); offset += 2; // mono
    buffer.writeUInt32LE(sampleRate, offset); offset += 4; // sample rate
    buffer.writeUInt32LE(sampleRate * 2, offset); offset += 4; // byte rate
    buffer.writeUInt16LE(2, offset); offset += 2; // block align
    buffer.writeUInt16LE(16, offset); offset += 2; // bits per sample
    
    // data chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;
    
    // Copy PCM data
    pcmBuffer.copy(buffer, offset);
    
    console.log(`Converted PCM to WAV: ${pcmBuffer.length} bytes PCM -> ${buffer.length} bytes WAV`);
    return buffer;
  }
}
