import Foundation
import AVFoundation
import CoreAudio

// MARK: - Logger

enum LogLevel: String {
    case info = "INFO"
    case error = "ERROR"
    case debug = "DEBUG"
}

struct Logger {
    static func log(_ level: LogLevel, _ message: String) {
        print("\(level.rawValue): \(message)")
        if level == .error {
            fflush(stderr)
        } else {
            fflush(stdout)
        }
    }
    
    static func info(_ message: String) { log(.info, message) }
    static func error(_ message: String) { log(.error, message) }
    static func debug(_ message: String) { log(.debug, message) }
}

// MARK: - Error Types

enum AudioMixerError: LocalizedError {
    case invalidUsage(String)
    case permissionDenied
    case audioSetupFailed(String)
    case recordingFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidUsage(let usage):
            return usage
        case .permissionDenied:
            return "Microphone permission denied"
        case .audioSetupFailed(let reason):
            return "Failed to setup audio: \(reason)"
        case .recordingFailed(let reason):
            return "Recording failed: \(reason)"
        }
    }
}

// MARK: - Permission Manager

struct PermissionManager {
    static func checkAndRequestMicrophonePermission() throws {
        Logger.info("Checking microphone permission...")
        
        // On macOS, we use AVCaptureDevice for microphone permission
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            Logger.info("Microphone permission already granted")
            return
        case .denied, .restricted:
            Logger.error("Microphone permission denied")
            throw AudioMixerError.permissionDenied
        case .notDetermined:
            Logger.info("Requesting microphone permission...")
            let semaphore = DispatchSemaphore(value: 0)
            var permissionGranted = false
            
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                permissionGranted = granted
                semaphore.signal()
            }
            
            semaphore.wait()
            
            if !permissionGranted {
                Logger.error("Microphone permission denied")
                throw AudioMixerError.permissionDenied
            }
            
            Logger.info("Microphone permission granted")
        @unknown default:
            Logger.error("Unknown microphone permission state")
            throw AudioMixerError.permissionDenied
        }
    }
}

// MARK: - Audio Mixer

@available(macOS 10.14, *)
class AudioMixer {
    private var audioEngine: AVAudioEngine?
    private var microphoneNode: AVAudioInputNode?
    private var mixerNode: AVAudioMixerNode?
    private var outputFile: AVAudioFile?
    private var isRecording = false
    
    init() {
        // No audio session setup needed on macOS
        Logger.info("AudioMixer initialized")
    }
    
    func startRecording(outputPath: String) throws {
        guard !isRecording else {
            throw AudioMixerError.recordingFailed("Recording already in progress")
        }
        
        Logger.info("Setting up audio recording...")
        
        // Create audio engine and nodes
        audioEngine = AVAudioEngine()
        mixerNode = AVAudioMixerNode()
        
        guard let engine = audioEngine, let mixer = mixerNode else {
            throw AudioMixerError.audioSetupFailed("Failed to create audio engine or mixer")
        }
        
        // Attach mixer to engine
        engine.attach(mixer)
        
        // Get microphone input node
        microphoneNode = engine.inputNode
        guard let micNode = microphoneNode else {
            throw AudioMixerError.audioSetupFailed("Failed to get microphone input node")
        }
        
        // Configure audio format (16kHz, mono, 16-bit)
        let inputFormat = micNode.outputFormat(forBus: 0)
        let recordingFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, 
                                          sampleRate: 16000, 
                                          channels: 1, 
                                          interleaved: false)
        
        guard let format = recordingFormat else {
            throw AudioMixerError.audioSetupFailed("Failed to create audio format")
        }
        
        // Connect microphone to mixer
        engine.connect(micNode, to: mixer, format: inputFormat)
        
        // Connect mixer to main mixer for monitoring (optional)
        engine.connect(mixer, to: engine.mainMixerNode, format: format)
        
        // Create output file
        let outputURL = URL(fileURLWithPath: outputPath)
        do {
            outputFile = try AVAudioFile(forWriting: outputURL, settings: format.settings)
        } catch {
            throw AudioMixerError.audioSetupFailed("Failed to create output file: \(error.localizedDescription)")
        }
        
        guard let file = outputFile else {
            throw AudioMixerError.audioSetupFailed("Output file is nil")
        }
        
        // Install tap on mixer to record audio
        mixer.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, time in
            do {
                try file.write(from: buffer)
            } catch {
                Logger.error("Failed to write audio buffer: \(error.localizedDescription)")
            }
        }
        
        // Start the audio engine
        do {
            try engine.start()
            isRecording = true
            Logger.info("Audio recording started (microphone only)")
            print("READY")
            fflush(stdout)
        } catch {
            throw AudioMixerError.recordingFailed("Failed to start audio engine: \(error.localizedDescription)")
        }
    }
    
    func stopRecording() {
        guard isRecording, let engine = audioEngine else {
            Logger.info("No recording in progress")
            return
        }
        
        Logger.info("Stopping audio recording...")
        
        // Remove tap
        mixerNode?.removeTap(onBus: 0)
        
        // Stop engine
        engine.stop()
        
        // Close output file
        outputFile = nil
        
        isRecording = false
        audioEngine = nil
        mixerNode = nil
        microphoneNode = nil
        
        Logger.info("Audio recording stopped")
    }
}

// MARK: - Signal Handler

@available(macOS 10.14, *)
struct SignalHandler {
    private static var audioMixer: AudioMixer?
    
    static func setup(audioMixer: AudioMixer) {
        self.audioMixer = audioMixer
        
        for sig in [SIGINT, SIGTERM] {
            signal(sig) { signal in
                Logger.info("Received signal \(signal), shutting down...")
                
                SignalHandler.audioMixer?.stopRecording()
                
                Logger.info("Stopping CFRunLoop...")
                DispatchQueue.main.async {
                    CFRunLoopStop(CFRunLoopGetMain())
                }
                
                sleep(1) // Give cleanup a chance to complete
            }
        }
    }
}

// MARK: - Run Loop Manager

struct RunLoopManager {
    static func runMainRunLoop() {
        Logger.info("Starting run loop on main thread")
        
        autoreleasepool {
            CFRunLoopRun()
        }
        
        Logger.info("Run loop stopped, process exiting")
    }
}

// MARK: - Main CLI

@available(macOS 10.14, *)
@main
struct AudioMixerCLI {
    static func main() async {
        do {
            try await run()
        } catch {
            if let audioError = error as? AudioMixerError {
                fputs("ERROR: \(audioError.localizedDescription)\n", stderr)
            } else {
                fputs("ERROR: \(error.localizedDescription)\n", stderr)
            }
            exit(2)
        }
    }
    
    private static func run() async throws {
        Logger.info("AudioMixerCLI starting...")
        Logger.info("Arguments: \(CommandLine.arguments)")
        
        guard CommandLine.arguments.count >= 2 else {
            throw AudioMixerError.invalidUsage("Usage: AudioMixerCLI <output-file-path>")
        }
        
        let outputPath = CommandLine.arguments[1]
        
        // Check microphone permissions
        try PermissionManager.checkAndRequestMicrophonePermission()
        
        // Create audio mixer
        let audioMixer = AudioMixer()
        
        // Setup signal handlers for clean shutdown
        SignalHandler.setup(audioMixer: audioMixer)
        
        Logger.info("Starting audio recording to: \(outputPath)")
        
        // Start recording
        try audioMixer.startRecording(outputPath: outputPath)
        
        Logger.info("Audio mixer now running indefinitely")
        
        // Start main run loop
        await startMainRunLoop()
    }
    
    private static func startMainRunLoop() async {
        Logger.info("Entering main run loop")
        
        // Dispatch to the main thread to call CFRunLoopRun
        DispatchQueue.main.async {
            RunLoopManager.runMainRunLoop()
        }
        
        // Keep this task alive until the runloop exits
        while true {
            try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
        }
    }
}
