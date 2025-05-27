# IKIAG Codebase Map

**IKIAG** is an AI assistant application that remains invisible to screen-sharing software while providing intelligent responses through combined audio and visual analysis using Google's Gemini AI.

## Application Overview

IKIAG enables users to:

- Record system audio and microphone input simultaneously
- Capture desktop screenshots on demand (Cmd/Ctrl + Enter)
- Send combined audio context and visual information to AI for analysis
- Receive contextual responses to questions, interviews, or meeting content
- Continue conversations with follow-up interactions
- Reset sessions for fresh starts (Cmd/Ctrl + R)

The application is specifically designed to be undetectable by screen capture software like Zoom, Google Meet, and other conferencing tools.

## Directory Structure

### `/electron` - Electron Main Process

The core backend functionality running in the Electron main process. Handles system-level operations, AI processing, and coordination between components.

**Key Components:**

- `main.ts` - Application entry point and lifecycle management
- `AudioHelper.ts` - Multi-source audio recording with intelligent fallbacks
- `ScreenshotHelper.ts` - Cross-platform screenshot capture and queue management
- `ProcessingHelper.ts` - Google Gemini AI integration and response handling
- `ScreenCaptureHelper.ts` - Screen sharing invisibility via Swift helpers
- `shortcuts.ts` - Global keyboard shortcut management
- `ipcHandlers.ts` - Inter-process communication handlers
- `preload.ts` - Secure bridge between main and renderer processes

**Responsibilities:**

- System audio and microphone recording
- Screenshot capture and management
- AI API communication and processing
- Global keyboard shortcut handling
- Window management and positioning
- Screen capture protection
- Persistent configuration storage

### `/src` - React Frontend (Renderer Process)

The user interface built with React, TypeScript, and Tailwind CSS. Provides an intuitive interface for interacting with the AI assistant.

**Key Areas:**

- `App.tsx` - Main application component with routing and providers
- `components/` - React components organized by functionality
- `types/` - TypeScript type definitions for type safety
- `utils/` - Frontend utility functions and helpers
- `lib/` - Third-party library configurations

**Component Structure:**

- `initial/` - Landing view for first screenshots and onboarding
- `response/` - AI response display with markdown rendering
- `follow-up/` - Follow-up interaction and conversation management
- `main/` - View coordination and state management
- `shared/` - Reusable components across views
- `ui/` - Shadcn UI component library implementations

**Responsibilities:**

- User interface rendering and interaction
- Real-time screenshot preview and management
- AI response display with rich formatting
- Configuration interface (API keys, model selection)
- Window sizing and positioning feedback
- Command palette and help system

### `/swift-helpers` - Native macOS Utilities

Swift-based command-line utilities that provide macOS-specific functionality not available through Electron or Node.js.

**Components:**

- `ScreenFilterCLI.swift` - Screen capture protection using ScreenCaptureKit
- `AudioMixerCLI.swift` - Advanced audio mixing using AVFoundation
- `Package.swift` - Swift Package Manager configuration

**Capabilities:**

- **Screen Filtering**: Makes the application invisible to screen sharing software
- **Audio Mixing**: Professional-grade audio recording and mixing
- **System Integration**: Deep macOS integration for seamless operation
- **Permission Management**: Handles screen recording and microphone permissions

**Requirements:**

- macOS 12.3+ for ScreenCaptureKit support
- Screen Recording permission for window filtering
- Microphone permission for audio recording

### `/assets` - Application Resources

Static resources and build assets for the application.

**Contents:**

- `icons/` - Platform-specific application icons (macOS, Windows)
- Build resources and metadata
- Application branding and visual assets

### `/build` - Build Configuration

Configuration files for application building and packaging.

**Contents:**

- `entitlements.mac.plist` - macOS security entitlements for app store and notarization
- Platform-specific build configurations
- Code signing and notarization settings

### Supporting Files

**Configuration:**

- `package.json` - Node.js dependencies and build scripts
- `tsconfig.json` - TypeScript configuration for the renderer
- `tsconfig.electron.json` - TypeScript configuration for the main process
- `vite.config.ts` - Vite bundler configuration for the frontend
- `tailwind.config.js` - Tailwind CSS styling configuration

**Development:**

- `components.json` - Shadcn UI component configuration
- `postcss.config.js` - PostCSS processing configuration
- `.gitignore` - Git ignore patterns
- `env.d.ts` - TypeScript environment declarations

## Technical Architecture

### Process Architecture

- **Main Process**: Electron main process handling system operations
- **Renderer Process**: React application providing the user interface
- **Swift Helpers**: Native utilities for macOS-specific functionality

### Communication Flow

1. **User Input**: Global shortcuts trigger actions in the main process
2. **Audio Recording**: AudioHelper manages multi-source recording
3. **Screenshot Capture**: ScreenshotHelper captures and queues images
4. **AI Processing**: ProcessingHelper sends combined context to Gemini API
5. **UI Updates**: IPC events update the React interface in real-time
6. **Response Display**: AI responses are formatted and displayed to the user

### Data Management

- **Screenshot Queues**: Separate queues for initial and follow-up screenshots
- **Audio Buffers**: In-memory audio management with optional disk persistence
- **Configuration Store**: Custom JSON-based storage for API keys and preferences
- **State Synchronization**: Real-time sync between main and renderer processes

### Security & Privacy

- **Screen Capture Protection**: Swift helpers prevent detection by screen sharing
- **Permission Management**: Proper handling of macOS permissions
- **Data Privacy**: No persistent storage of sensitive audio or visual data
- **Code Signing**: Proper macOS code signing and notarization

## Development Workflow

### Build Process

1. **Swift Helpers**: Native utilities built with Swift Package Manager
2. **Frontend**: React application bundled with Vite
3. **Main Process**: TypeScript compiled to JavaScript
4. **Packaging**: Electron Builder creates platform-specific distributions

### Cross-Platform Support

- **macOS**: Full functionality with Swift helpers
- **Windows**: Core functionality with alternative implementations
- **Code Sharing**: Maximum code reuse between platforms

### Dependencies

- **Frontend**: React, TypeScript, Tailwind CSS, TanStack Query
- **Backend**: Electron, Google Generative AI, Screenshot Desktop
- **Native**: Swift, AVFoundation, ScreenCaptureKit (macOS)

This architecture provides a robust, cross-platform AI assistant that seamlessly integrates with the user's workflow while maintaining invisibility to screen sharing software.
