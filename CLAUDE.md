# Cass - AI Assistant Context Guide

## What This Application Does

Cass is an **invisible AI assistant** for screen-sharing sessions. It records audio and captures screenshots, then uses Google Gemini AI to provide contextual responses during calls, interviews, or meetings. The application remains completely hidden from screen capture software like Zoom, Google Meet, and Microsoft Teams.

## Key Behaviors & Rules

### Critical Requirements
- **Screen protection is MANDATORY on macOS** - the app will NOT start without screen recording permissions
- **Swift helpers are REQUIRED** - application exits with error dialog if they fail to initialize
- **No fallback mode** - reliability over availability

### User Workflow
1. User presses `Cmd/Ctrl + Enter` → starts audio recording and takes screenshot
2. Audio + screenshot sent to Google Gemini AI
3. AI response displayed in the UI
4. User can continue with follow-ups or reset with `Cmd/Ctrl + R`

### Core Features
- **Audio recording**: Multi-source (system + microphone) with intelligent fallbacks
- **Screenshot capture**: Platform-specific implementations with queue management
- **AI processing**: Google Gemini integration with context management
- **Screen invisibility**: Swift helpers make app invisible to screen sharing

## Architecture Overview

### Process Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ React Frontend  │◄──►│ Electron Main   │◄──►│ Swift Helpers   │
│ (Renderer)      │    │ (Node.js)       │    │ (Native macOS)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Components
- **Main Process**: `/electron/` - Core functionality, system operations
- **Renderer Process**: `/src/` - React UI, user interface
- **Swift Helpers**: `/swift-helpers/` - **CRITICAL** native macOS utilities
- **Assets**: `/assets/` - Icons and build resources

## File Structure Deep Dive

### `/electron/` - Main Process (Node.js)
- `main.ts` - App lifecycle, window management, **MANDATORY** Swift helper initialization
- `AudioHelper.ts` - Multi-source recording with FFmpeg and Swift fallbacks
- `ProcessingHelper.ts` - Google Gemini API integration and context management
- `ScreenshotHelper.ts` - Cross-platform screenshot capture and queue management
- `ScreenCaptureHelper.ts` - **CRITICAL** screen sharing invisibility via Swift helpers
- `shortcuts.ts` - Global keyboard shortcuts
- `ipcHandlers.ts` - IPC communication between main and renderer
- `preload.ts` - Secure bridge for renderer-main communication

### `/src/` - Renderer Process (React)
- `App.tsx` - Root component with providers and routing
- `components/` - React components organized by functionality
  - `initial/` - Landing view for first screenshots
  - `response/` - AI response display with markdown
  - `follow-up/` - Follow-up interactions
  - `main/` - View coordination and state management
  - `shared/` - Reusable components
  - `ui/` - Shadcn UI components
- `types/` - TypeScript interfaces and type definitions
- `utils/` - Frontend utilities and helpers
- `lib/` - Third-party library configurations

### `/swift-helpers/` - Native macOS Utilities
- `ScreenFilterCLI.swift` - **MANDATORY** screen capture protection
- `AudioMixerCLI.swift` - Advanced audio mixing with AVFoundation
- `Package.swift` - Swift Package Manager configuration

## Development Patterns

### Error Handling Philosophy
- **Fail fast**: App exits immediately if critical components fail
- **User-friendly errors**: Clear error dialogs with actionable instructions
- **No silent failures**: All errors are visible to users

### State Management
- **View states**: `initial` → `response` → `followup` → `initial`
- **Screenshot queues**: Separate queues for initial and follow-up screenshots
- **Configuration**: JSON-based storage for API keys and preferences

### IPC Communication
- **Secure**: Uses context bridge for renderer-main communication
- **Typed**: All IPC calls have TypeScript interfaces
- **Event-driven**: Real-time updates via IPC events

## Common Development Tasks

### Adding New Features
1. **Define types** in `/src/types/` first
2. **Add IPC handlers** in `/electron/ipcHandlers.ts`
3. **Implement main process logic** in appropriate helper
4. **Create UI components** in `/src/components/`
5. **Update context bridge** in `/electron/preload.ts`

### Handling Permissions
- **Screen recording**: Check with `ScreenCaptureHelper.checkPermissions()`
- **Microphone**: Handle through `AudioHelper.requestPermissions()`
- **Error dialogs**: Use `dialog.showErrorBox()` for critical failures

### Building and Testing
- **Development**: `npm run dev` (requires Swift helpers built)
- **Production**: `npm run build` (builds Swift helpers automatically)
- **Swift helpers**: `npm run build:swift` (required for macOS functionality)

## Common Pitfalls & Solutions

### App Won't Start on macOS
- **Problem**: Screen recording permission not granted
- **Solution**: System Preferences → Security & Privacy → Privacy → Screen Recording
- **Code**: App shows error dialog and exits (no fallback)

### Swift Helpers Not Found
- **Problem**: Helpers not built or path incorrect
- **Solution**: Run `npm run build:swift` and check build output
- **Code**: `ScreenCaptureHelper.ts` handles path resolution

### Audio Recording Issues
- **Problem**: Multiple audio sources not working
- **Solution**: `AudioHelper.ts` has intelligent fallbacks
- **Code**: Falls back to microphone-only or system-only

### IPC Communication Errors
- **Problem**: Type mismatches or missing handlers
- **Solution**: Check `ipcHandlers.ts` and `preload.ts`
- **Code**: All IPC calls should be typed in interfaces

## AI Processing Workflow

### Context Management
1. **Initial**: Screenshot + audio → first AI response
2. **Follow-up**: Previous context + new screenshot + audio → continued response
3. **Reset**: Clear all context and start fresh

### API Integration
- **Google Gemini**: Primary AI model for processing
- **Rate limiting**: Handle API limits gracefully
- **Error handling**: Network errors, API errors, quota exceeded

### Response Formatting
- **Markdown**: AI responses formatted as markdown
- **Syntax highlighting**: Code blocks with language detection
- **Interactive elements**: Buttons for follow-up actions

## Key Dependencies

### Frontend
- **React 18**: UI framework
- **TypeScript**: Type safety
- **TanStack Query**: Data fetching and caching
- **Tailwind CSS**: Styling
- **Shadcn UI**: Component library

### Backend
- **Electron**: Desktop app framework
- **Google Generative AI**: AI processing
- **screenshot-desktop**: Cross-platform screenshots
- **FFmpeg**: Audio recording (macOS)

### Native
- **Swift**: macOS-specific functionality
- **AVFoundation**: Audio processing
- **ScreenCaptureKit**: Screen capture protection

## Testing Strategy

### Unit Testing
- **Frontend**: React components with Jest + React Testing Library
- **Backend**: Main process helpers with Jest
- **Swift**: XCTest for native utilities

### Integration Testing
- **IPC**: Main-renderer communication
- **API**: Google Gemini integration
- **Permissions**: System permission handling

### Manual Testing
- **Screen sharing**: Test invisibility with Zoom, Meet, Teams
- **Audio recording**: Test various device configurations
- **Cross-platform**: Test on different macOS versions

## Deployment Considerations

### macOS App Store
- **Entitlements**: Proper permissions in `build/entitlements.mac.plist`
- **Sandboxing**: Handle sandbox restrictions
- **Notarization**: Required for distribution

### Direct Distribution
- **Code signing**: Developer ID certificate
- **Auto-updates**: Electron-builder update mechanism
- **Crash reporting**: Error tracking and reporting

### Security
- **Permissions**: Minimal required permissions
- **Data handling**: No persistent storage of sensitive data
- **Network**: Secure API communication only

## Performance Optimization

### Memory Management
- **Screenshot cleanup**: Automatic old file deletion
- **Audio buffers**: In-memory with cleanup
- **React optimization**: Proper memoization and optimization

### Native Performance
- **Swift helpers**: Compiled native code for performance
- **Audio processing**: Real-time audio with low latency
- **Screen capture**: Efficient screenshot capture

## Debugging Tips

### Common Issues
- **App exits immediately**: Check screen recording permissions
- **No audio**: Check microphone permissions and device availability
- **No screenshots**: Check screenshot command accessibility
- **Swift errors**: Check Xcode command line tools installation

### Debug Tools
- **Electron DevTools**: Frontend debugging
- **Console logs**: Main process logging
- **Swift output**: CLI tool stdout/stderr
- **IPC monitoring**: Track communication between processes

## Future Enhancements

### Planned Features
- **Multi-monitor support**: Enhanced screenshot capture
- **Audio transcription**: Real-time speech-to-text
- **Custom prompts**: User-defined AI prompts
- **Export functionality**: Save conversations and screenshots

### Technical Improvements
- **Performance**: Optimize audio and screenshot processing
- **Security**: Enhanced permission handling
- **Reliability**: Better error recovery and fallbacks
- **Cross-platform**: Windows and Linux Swift helper alternatives

---

This guide provides comprehensive context for AI assistants working with the Cass codebase. The application prioritizes reliability and user experience over feature completeness, with mandatory security features and clear error handling.