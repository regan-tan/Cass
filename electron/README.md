# Electron Process Files

This directory contains the core files for the Electron main process and related functionalities.

## File Descriptions

- `main.ts`: This is the entry point for the Electron main process. It is responsible for:

  - Managing the application lifecycle (startup, quit).
  - Creating and managing browser windows (`BrowserWindow`).
  - Initializing and managing global application state.
  - Coordinating interactions between different helper modules.
  - Setting up environment variables and application configuration, including the persistent store for API keys and model preferences.
  - Loading the `index.html` file or a development server URL into the main window.
  - Handling window movement, resizing, and visibility.

- `ProcessingHelper.ts`: This class is responsible for handling the logic related to processing screenshots with a generative AI model (specifically Google's Gemini). Its key responsibilities include:

  - Communicating with the AI model via API calls.
  - Managing the state of processing (e.g., `isCurrentlyProcessing`).
  - Handling different processing views (`initial`, `response`, `followup`).
  - Preparing image data for API requests.
  - Parsing responses from the AI model.
  - Managing `AbortController` instances to cancel ongoing API requests.
  - Emitting events to the renderer process to update the UI based on processing status (e.g., start, success, error, no screenshots).

- `preload.ts`: This script runs in a privileged environment before the renderer process's web page is loaded. Its primary purpose is to securely expose specific Node.js and Electron APIs to the renderer process via the `contextBridge`. This includes:

  - Defining a an `electronAPI` object with functions that the renderer can call. These functions typically invoke IPC handlers in the main process.
  - Setting up listeners for IPC messages sent from the main process to the renderer (e.g., `screenshot-taken`, `reset-view`, various processing events).
  - Exposing a list of `PROCESSING_EVENTS` constants for consistent event naming between main and renderer.

- `ipcHandlers.ts`: This file initializes and defines all Inter-Process Communication (IPC) handlers. These handlers are listeners in the main process that respond to messages sent from the renderer process (via the `electronAPI` exposed in `preload.ts`). Key functionalities handled here include:

  - Getting and setting API configuration (API key, model).
  - Managing screenshot queues (getting, deleting).
  - Triggering screenshot capture and processing.
  - Updating window dimensions.
  - Handling application reset and state clearing.
  - Toggling window visibility and managing mouse event pass-through.
  - Opening external links.

- `shortcuts.ts`: This class manages the registration and unregistration of global keyboard shortcuts for the application. It defines actions to be taken when specific key combinations are pressed, such as:

  - Taking a screenshot and processing it (`CommandOrControl+Enter`).
  - Resetting the application state (`CommandOrControl+R`).
  - Moving the application window (`CommandOrControl+ArrowKeys`).
  - Toggling window visibility (`CommandOrControl+\`).
  - It dynamically registers/unregisters app-specific shortcuts based on window visibility to avoid conflicts when the app window is hidden.

- `ScreenshotHelper.ts`: This class is responsible for all operations related to capturing and managing screenshots. Its duties include:

  - Capturing screenshots using platform-specific commands (`screencapture` on macOS, PowerShell on Windows).
  - Saving screenshots to designated directories (`screenshots` and `extra_screenshots` within the app's user data path).
  - Managing two separate screenshot queues: a main queue for initial processing and an "extra" queue for follow-up screenshots.
  - Enforcing a maximum number of screenshots per queue (currently 1), deleting older ones as new ones are added.
  - Providing image previews in base64 format.
  - Deleting individual screenshots from the queues and file system.
  - Synchronizing its state with the application's current `view` (`initial`, `response`, `followup`) to determine which queue to use.
