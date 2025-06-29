# Electron Main Process

This directory contains the core Electron main process files responsible for managing the application lifecycle, handling system-level operations, and coordinating between the UI and native system capabilities.

## Core Architecture

The main process orchestrates several specialized helper classes to provide the application's functionality:

- **Audio recording and processing** via `AudioHelper`
- **Screenshot capture and management** via `ScreenshotHelper`
- **AI processing and API communication** via `ProcessingHelper`
- **Screen capture protection** via `ScreenCaptureHelper`
- **Global keyboard shortcuts** via `ShortcutsHelper`
- **Inter-process communication** via `ipcHandlers`

## File Descriptions

### `main.ts`

The application entry point that manages:

- **Application lifecycle**: Startup, window creation, quit handling
- **Window management**: Creating, positioning, and controlling the main BrowserWindow
- **Global state coordination**: Managing view states (`initial`, `response`, `followup`)
- **Configuration management**: Persistent storage for API keys and model preferences using a custom JSON-based store
- **Helper initialization**: Instantiating and coordinating all helper classes
- **Environment setup**: Loading development vs production configurations
- **MANDATORY Screen capture protection**: Requires Swift helpers to start - application exits if protection fails

### `AudioHelper.ts`

Handles all audio recording operations with multiple fallback strategies:

- **Multi-source recording**: Attempts to record both system audio and microphone simultaneously
- **Platform-specific implementations**: Uses FFmpeg on macOS, with Swift helper fallbacks
- **Intelligent fallbacks**: If mixed recording fails, falls back to microphone-only or system-only
- **Memory management**: Stores audio data in memory with optional disk persistence for processing
- **Recording state management**: Tracks recording sessions with start/end times and duration
- **Format optimization**: Outputs mono audio optimized for speech recognition

### `ProcessingHelper.ts`

Manages AI processing workflows and API communication:

- **Google Gemini integration**: Handles API authentication and request formatting
- **Context management**: Maintains conversation history and follow-up context
- **Image processing**: Prepares screenshots for API submission (base64 encoding)
- **Audio transcription**: Processes recorded audio through the AI model
- **Response handling**: Parses and formats AI responses for the UI
- **Abort control**: Manages request cancellation for ongoing API calls
- **Error handling**: Comprehensive error management with user-friendly messages
- **View state coordination**: Handles different processing flows based on current view

### `ScreenshotHelper.ts`

Manages screenshot capture and queue management:

- **Platform-specific capture**: Uses `screencapture` on macOS, PowerShell on Windows
- **Dual queue system**: Maintains separate queues for initial and follow-up screenshots
- **Automatic cleanup**: Enforces maximum queue sizes and removes old files
- **Preview generation**: Creates base64 previews for UI display
- **File system management**: Organizes screenshots in user data directories
- **Queue synchronization**: Coordinates with application view states
- **Batch operations**: Supports processing multiple screenshots simultaneously

### `ScreenCaptureHelper.ts`

Provides CRITICAL screen sharing invisibility through native Swift helpers:

- **Swift helper management**: Spawns and manages the ScreenFilterCLI process
- **Window exclusion**: Uses macOS ScreenCaptureKit to exclude the app from screen recordings
- **Process lifecycle**: Handles starting, stopping, and monitoring the helper process
- **MANDATORY Permission management**: Ensures proper screen recording permissions - throws errors if unavailable
- **Failure handling**: No error recovery - application exits if protection cannot be established
- **Development vs production**: Adapts helper paths for different build environments
- **User-friendly error dialogs**: Shows clear error messages when protection fails

### `shortcuts.ts` (ShortcutsHelper)

Manages global keyboard shortcuts and window controls:

- **Global shortcut registration**: Uses Electron's globalShortcut API
- **Dynamic registration**: Registers/unregisters shortcuts based on window visibility
- **Window movement**: Handles arrow key navigation to move the window
- **Action triggers**: Maps shortcuts to specific application functions
- **Conflict avoidance**: Prevents shortcut conflicts when the window is hidden
- **Context-aware shortcuts**: Different behavior based on application state

### `ipcHandlers.ts`

Defines Inter-Process Communication between main and renderer processes:

- **API configuration**: Handlers for getting/setting API keys and model preferences
- **Screenshot operations**: Triggering capture, retrieving queues, deleting images
- **Processing control**: Starting AI processing and handling responses
- **Window management**: Updating dimensions, toggling visibility, mouse pass-through
- **Application state**: Reset functionality and state clearing
- **External links**: Safe opening of URLs in the default browser
- **Error propagation**: Proper error handling between processes
- **Screen protection status**: New handler to check if screen capture protection is active

### `preload.ts`

Security bridge between main and renderer processes:

- **Context bridge setup**: Safely exposes main process APIs to the renderer
- **API surface definition**: Defines the `electronAPI` interface available to the UI
- **Event forwarding**: Sets up listeners for main-to-renderer communication
- **Type safety**: Ensures proper TypeScript typing for IPC communication
- **Security isolation**: Maintains security while enabling necessary functionality
- **Event constants**: Provides consistent event naming across processes

## Dependencies and Integration

- **Google Generative AI**: For AI processing and conversation management
- **Electron Store**: For persistent configuration (replaced with custom JSON store)
- **Screenshot Desktop**: For cross-platform screenshot capture
- **Child Process**: For spawning Swift helpers and native tools
- **File System**: For managing screenshot files and directories
- **Path utilities**: For cross-platform file path management

## Data Flow

1. **User Input**: Global shortcuts trigger actions
2. **Audio Recording**: AudioHelper starts recording system and microphone audio
3. **Screenshot Capture**: ScreenshotHelper captures and queues desktop images
4. **AI Processing**: ProcessingHelper sends combined context to Gemini API
5. **Response Handling**: Processed response flows back through IPC to the UI
6. **State Updates**: Main process updates view state and notifies renderer
7. **Follow-up Capability**: Subsequent inputs build on existing context

- Capturing screenshots using platform-specific commands (`screencapture` on macOS, PowerShell on Windows).
- Saving screenshots to designated directories (`screenshots` and `extra_screenshots` within the app's user data path).
- Managing two separate screenshot queues: a main queue for initial processing and an "extra" queue for follow-up screenshots.
- Enforcing a maximum number of screenshots per queue (currently 1), deleting older ones as new ones are added.
- Providing image previews in base64 format.
- Deleting individual screenshots from the queues and file system.
- Synchronizing its state with the application's current `view` (`initial`, `response`, `followup`) to determine which queue to use.
