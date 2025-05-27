# IKIAG - AI Assistant for Screen Share

**IKIAG** is an invisible AI assistant designed to help users during screen-sharing sessions like Zoom calls, Google Meet, interviews, or presentations. The application remains hidden from screen capture software while providing intelligent, contextual responses through AI analysis.

## Overview

IKIAG works by recording system audio and microphone input simultaneously. When you press `Cmd/Ctrl + Enter`, it captures a screenshot of your desktop and sends both the audio context (from recording start to keystroke) and the visual information to Google's Gemini AI via API. The AI then provides proactive responses to:

- Questions asked by interviewers or meeting participants
- User queries (avoiding the need to switch to ChatGPT)
- Content visible in screenshots
- Follow-up discussions building on previous context

The application is specifically designed to be invisible to screen-sharing software, making it perfect for professional calls, interviews, and presentations where you need AI assistance without detection.

## Key Features

- **Invisible to Screen Share**: Uses advanced screen filtering to remain hidden from Zoom, Google Meet, and other screen capture software
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

## Project Structure

- `/electron` - Electron main process files (audio recording, screenshot capture, AI processing)
- `/src` - React frontend components (renderer process UI)
- `/swift-helpers` - Native Swift helpers for audio mixing and screen filtering on macOS
- `/assets` - Application icons and resources
- `/build` - Build configuration and entitlements
