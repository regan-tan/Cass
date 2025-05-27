# Swift Native Helpers

This directory contains Swift-based native utilities that provide macOS-specific functionality for audio mixing and screen capture protection. These helpers are essential for the application's core feature of remaining invisible to screen sharing software.

## Overview

The Swift helpers leverage macOS-specific APIs that are not available through Electron or Node.js, providing:

- **Advanced audio mixing** capabilities using AVFoundation
- **Screen capture filtering** using ScreenCaptureKit (macOS 12.3+)
- **Native performance** for real-time audio and video operations
- **Deep system integration** for seamless user experience

## Architecture

### Package Structure

- **Swift Package Manager**: Uses `Package.swift` for dependency management and build configuration
- **Two executable targets**: `ScreenFilterCLI` and `AudioMixerCLI` as separate binaries
- **Minimum macOS 12**: Required for ScreenCaptureKit APIs
- **Command-line interface**: Both tools operate as CLI utilities spawned by the main Electron process

## Components

### `Package.swift`

Swift Package Manager configuration that:

- **Defines build targets**: Two separate executable targets for different functionalities
- **Sets platform requirements**: macOS 12+ for ScreenCaptureKit compatibility
- **Manages dependencies**: Currently uses only system frameworks
- **Configures build products**: Exports both CLI tools as executable products

### `ScreenFilterCLI.swift`

A command-line utility for screen capture protection that:

#### **Core Functionality**

- **Window exclusion**: Uses ScreenCaptureKit to exclude specific windows from screen recordings
- **Process targeting**: Identifies and filters windows by process ID and optional window title
- **Permission management**: Handles screen recording permission requests and validation
- **Real-time filtering**: Continuously monitors and updates capture exclusions

#### **Technical Implementation**

- **ScreenCaptureKit integration**: Leverages Apple's latest screen capture APIs
- **Permission handling**: Checks and requests necessary screen recording permissions
- **Window discovery**: Finds target windows using process ID and title matching
- **Error handling**: Comprehensive error management with detailed logging
- **Process lifecycle**: Runs continuously until terminated by parent process

#### **Security Features**

- **Permission validation**: Ensures proper screen recording permissions before operation
- **Safe window targeting**: Validates window ownership and properties
- **Graceful degradation**: Handles permission denials and system limitations

#### **Usage Pattern**

```bash
ScreenFilterCLI <process-id> [window-title]
```

- Spawned by `ScreenCaptureHelper.ts` in the main Electron process
- Receives the Electron app's process ID to exclude its windows
- Optionally filters by specific window titles for precision

### `AudioMixerCLI.swift`

A command-line utility for advanced audio recording that:

#### **Core Functionality**

- **Multi-source recording**: Captures both microphone and system audio simultaneously
- **Real-time mixing**: Combines audio streams using AVAudioEngine
- **Format optimization**: Outputs audio optimized for speech recognition and AI processing
- **Fallback strategies**: Handles various audio device configurations gracefully

#### **Technical Implementation**

- **AVFoundation integration**: Uses Apple's audio framework for professional-grade recording
- **Audio engine management**: Configures and manages complex audio processing graphs
- **Device discovery**: Automatically detects and configures available audio devices
- **Stream synchronization**: Ensures proper timing and mixing of multiple audio sources
- **Format conversion**: Converts to optimal formats for downstream processing

#### **Audio Processing Features**

- **Noise reduction**: Basic audio cleanup for better transcription accuracy
- **Level balancing**: Automatic gain control for consistent audio levels
- **Mono output**: Optimized single-channel output for speech processing
- **Low latency**: Minimal delay for real-time recording scenarios

#### **Integration Points**

- Called by `AudioHelper.ts` as a fallback when FFmpeg mixed recording fails
- Provides macOS-native audio capabilities not available through web technologies
- Handles microphone permissions through proper macOS authorization flows

## Build Process

### Development Build

```bash
swift build -c release
```

- Builds both CLI tools in release configuration
- Outputs binaries to `.build/release/` directory
- Used during development and testing

### Production Build (Universal Binary)

```bash
arch -arm64 swift build -c release
cp .build/release/swift-helpers .build/release/swift-helpers-universal
```

- Creates universal binaries for both Intel and Apple Silicon
- Handles architecture-specific optimizations
- Packaged with the final Electron application

### Integration with Electron

- **Development**: Direct execution from build directory
- **Production**: Bundled as extra resources in the Electron app package
- **Runtime**: Spawned as child processes by the main Electron process
- **Communication**: Uses stdout/stderr for logging and status communication

## System Requirements

### macOS Version Support

- **Minimum**: macOS 12.0 (Monterey) for ScreenCaptureKit
- **Recommended**: macOS 13.0+ for optimal performance
- **Architecture**: Supports both Intel (x64) and Apple Silicon (arm64)

### Permissions Required

- **Screen Recording**: Required for ScreenFilterCLI functionality
- **Microphone Access**: Required for AudioMixerCLI recording
- **Full Disk Access**: May be required in some enterprise environments

### System Integration

- **Screen sharing compatibility**: Works with Zoom, Google Meet, Microsoft Teams, etc.
- **Audio device support**: Compatible with built-in and external audio devices
- **Multi-monitor support**: Handles complex display configurations

## Security Considerations

### Permission Model

- **Explicit permission requests**: Both tools request only necessary permissions
- **Graceful degradation**: Function continues with reduced capabilities if permissions denied
- **User control**: Users can revoke permissions through System Preferences

### Privacy Protection

- **No data storage**: Tools process audio/video without persistent storage
- **Minimal system access**: Request only essential system capabilities
- **Transparent operation**: All functionality is visible to the user and system

### Code Signing

- **Developer ID**: Signed with Apple Developer ID for Gatekeeper compatibility
- **Notarization**: Notarized for macOS security requirements
- **Hardened runtime**: Runs with hardened runtime security features enabled

## Troubleshooting

### Common Issues

- **Permission errors**: Ensure Screen Recording permission is granted in System Preferences
- **Build failures**: Verify Xcode command line tools are installed
- **Runtime errors**: Check console output for detailed error messages
- **Performance issues**: Monitor system resources during intensive operations

### Debug Mode

Both CLI tools support verbose logging for troubleshooting:

- Detailed permission status reporting
- Audio device enumeration and status
- Screen capture session monitoring
- Error context and stack traces
