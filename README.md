# Cass - Invisible AI Assistant

**Cass** is your invisible AI companion for screen-sharing sessions. It stays completely hidden from Zoom, Google Meet, and other screen capture software while providing intelligent, contextual responses during calls, interviews, and presentations.

**Note: Cass is no longer invisible to Zoom out of the box due to changes in their screen recording mechanism. In order for it to be invisible, you will need to manually change the zoom screen recording permissions to advanced screen filtering.**

## How It Works

1. **Press `Cmd/Ctrl + Enter`** - Starts recording audio and takes a screenshot
2. **AI Analysis** - Combines audio context and visual information using Google Gemini AI
3. **Get Smart Responses** - Receive contextual answers to questions, discussions, and content
4. **Continue Conversations** - Follow up with additional context or reset with `Cmd/Ctrl + R`

Perfect for:

- Job interviews and technical assessments
- Client presentations and sales calls
- Educational lectures and training sessions
- Any situation where you need AI assistance without detection

## Key Features

- **Invisible to Screen Share**: Uses advanced screen filtering to remain hidden from Zoom, Google Meet, and other screen capture software
- **Mandatory Protection on macOS**: Application requires screen capture protection to run - ensures reliable undetectable operation
- **Audio + Visual Processing**: Combines system audio, microphone input, and screenshot analysis
- **Contextual AI Responses**: Powered by Google Gemini for intelligent, contextual replies
- **Follow-up Conversations**: Press `Cmd/Ctrl + Enter` again to continue the conversation with new context
- **Reset Functionality**: Press `Cmd/Ctrl + R` to start a fresh session
- **Cross-platform**: Works on macOS and Windows
- **Persistent Configuration**: Remembers API keys and model preferences

## Keyboard Shortcuts

- **Cmd/Ctrl + Enter**: Take screenshot and process with AI (start recording or add follow-up)
- **Cmd/Ctrl + R**: Reset session and clear context
- **Cmd/Ctrl + \\**: Toggle window visibility
- **Cmd/Ctrl + Q**: Quit the application
- **Arrow keys with Cmd/Ctrl**: Move window around the screen

## Quick Start

1. **Download and install** Cass for your platform
2. **Grant permissions** when prompted (Screen Recording on macOS is required)
3. **Set up your API key** in the configuration tooltip
4. **Press `Cmd/Ctrl + Enter`** to take your first screenshot and start using AI assistance

## Troubleshooting

### App Won't Start on macOS

**Most common issue**: Screen Recording permission not granted

**Solution**:

1. Open **System Preferences** > **Security & Privacy** > **Privacy**
2. Click **"Screen Recording"** in the left sidebar
3. Ensure **Cass is checked** in the list
4. If not listed, click **"+"** and add Cass
5. **Restart Cass** after granting permission

**System Requirements**: macOS 12.3+ required for screen protection features

### Why is Screen Protection Mandatory?

Cass prioritizes **reliable invisibility** over convenience. This ensures:

- **Consistent invisibility** during screen sharing sessions
- **No accidental exposure** that could compromise your privacy
- **Professional reliability** for high-stakes situations

## System Requirements

### macOS

- **macOS 12.3+** required for ScreenCaptureKit support
- **Screen Recording permission** required (System Preferences > Security & Privacy > Privacy > Screen Recording)
- Application will not start without proper screen capture protection

### Windows

- **Windows 10+** recommended
- Core functionality available (screen protection features limited)

## Project Structure

- `/electron` - Electron main process files (audio recording, screenshot capture, AI processing)
- `/src` - React frontend components (renderer process UI)
- `/swift-helpers` - **CRITICAL** Native Swift helpers for mandatory screen protection on macOS
- `/assets` - Application icons and resources
- `/build` - Build configuration and entitlements
