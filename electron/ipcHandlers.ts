import { getStoreValue, setStoreValue } from "./main";

import { initializeIpcHandlerDeps } from "./main";
import { ipcMain } from "electron";

export function initializeIpcHandlers(deps: initializeIpcHandlerDeps): void {
  console.log("Initializing IPC handlers");

  ipcMain.handle("get-api-config", async () => {
    try {
      const apiKey = await getStoreValue("api-key");
      const model = (await getStoreValue("api-model")) || "gpt-4o";
      const provider = (await getStoreValue("api-provider")) || "openai";
      const customPrompt = (await getStoreValue("custom-prompt")) || "";
      const openaiApiKey = await getStoreValue("openai-api-key");

      if (!apiKey) {
        return { success: false, error: "API key not found" };
      }

      return { success: true, apiKey, model, provider, customPrompt, openaiApiKey };
    } catch (error) {
      console.error("Error getting API config:", error);
      return { success: false, error: "Failed to retrieve API config" };
    }
  });

  // New handler for generic API configuration
  ipcMain.handle(
    "set-api-config",
    async (_event, config: { apiKey: string; model: string; provider?: string; customPrompt?: string; openaiApiKey?: string }) => {
      try {
        const { apiKey, model, provider, customPrompt, openaiApiKey } = config;

        if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
          return { success: false, error: "Invalid API key" };
        }

        if (!model || typeof model !== "string") {
          return { success: false, error: "Invalid model selection" };
        }

        // Determine provider from model if not explicitly provided
        const actualProvider = provider || 
          (model.startsWith("gpt-") ? "openai" : 
           (model.includes("/") ? "openrouter" : "gemini"));

        // Store the configuration using imported function
        const successKey = await setStoreValue("api-key", apiKey.trim());
        const successModel = await setStoreValue("api-model", model);
        const successProvider = await setStoreValue("api-provider", actualProvider);
        const successPrompt = await setStoreValue("custom-prompt", customPrompt || "");
        const successOpenAIKey = await setStoreValue("openai-api-key", openaiApiKey || "");

        if (!successKey || !successModel || !successProvider || !successPrompt || !successOpenAIKey) {
          console.error(
            "Failed to save one or more API config values to store."
          );
          // Optionally return an error, but setting env vars might still be useful
        }

        // Set environment variables based on provider
        process.env.API_KEY = apiKey.trim();
        process.env.API_MODEL = model;
        process.env.API_PROVIDER = actualProvider;
        
        // Set OpenAI key for audio transcription if provided
        if (openaiApiKey) {
          process.env.OPENAI_API_KEY = openaiApiKey;
        }

        // Notify that the config has been updated
        const mainWindow = deps.getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send("api-key-updated");
        }

        return { success: true };
      } catch (error) {
        console.error("Error setting API configuration:", error);
        return { success: false, error: "Failed to save configuration" };
      }
    }
  );

  ipcMain.handle("get-screenshot-queue", () => {
    return deps.getScreenshotQueue();
  });

  ipcMain.handle("get-extra-screenshot-queue", () => {
    return deps.getExtraScreenshotQueue();
  });

  // Screenshot processing handlers
  ipcMain.handle("process-screenshots", async () => {
    await deps.processingHelper?.processScreenshots();
  });

  // Window dimension handlers
  ipcMain.handle(
    "update-content-dimensions",
    async (_, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        deps.setWindowDimensions(width, height);
      }
    }
  );

  ipcMain.handle(
    "set-window-dimensions",
    (_, width: number, height: number) => {
      deps.setWindowDimensions(width, height);
    }
  );

  // Screenshot management handlers
  ipcMain.handle("get-screenshots", async () => {
    try {
      let previews = [];
      const currentView = deps.getView();

      if (currentView === "initial") {
        const queue = deps.getScreenshotQueue();
        previews = await Promise.all(
          queue.map(async (path) => ({
            path,
          }))
        );
      } else {
        const extraQueue = deps.getExtraScreenshotQueue();
        previews = await Promise.all(
          extraQueue.map(async (path) => ({
            path,
          }))
        );
      }

      return previews;
    } catch (error) {
      console.error("Error getting screenshots:", error);
      throw error;
    }
  });

  // Screenshot trigger handlers
  ipcMain.handle("trigger-screenshot", async () => {
    const mainWindow = deps.getMainWindow();
    if (mainWindow) {
      try {
        const screenshotPath = await deps.takeScreenshot();
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
        });
        return { success: true };
      } catch (error) {
        console.error("Error triggering screenshot:", error);
        return { error: "Failed to trigger screenshot" };
      }
    }
    return { error: "No main window available" };
  });

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await deps.takeScreenshot();
      return { success: true, path: screenshotPath };
    } catch (error) {
      console.error("Error taking screenshot:", error);
      return { success: false, error: String(error) };
    }
  });

  // Cancel processing handler
  ipcMain.handle("cancel-processing", () => {
    deps.processingHelper?.resetProcessing();
    return { success: true };
  });

  // Audio recording handlers
  ipcMain.handle("start-audio-recording", async () => {
    try {
      const result = await deps.startRecording();
      return { ...result };
    } catch (error) {
      console.error("Error starting audio recording:", error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle("stop-audio-recording", async () => {
    try {
      const result = await deps.stopRecording();
      
      // If recording was successful, automatically process it with AI
      if (result.success && result.recording) {
        console.log("Audio recording completed, processing with AI...");
        try {
          await deps.processingHelper?.processAudioRecording();
        } catch (error) {
          console.error("Error processing audio recording with AI:", error);
        }
      }
      
      return { ...result };
    } catch (error) {
      console.error("Error stopping audio recording:", error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle("get-audio-recording-status", () => {
    try {
      const status = deps.getRecordingStatus();
      return {
        success: true,
        isRecording: status.isRecording,
        recording: status.recording,
      };
    } catch (error) {
      console.error("Error getting audio recording status:", error);
      return { success: false, error: String(error), isRecording: false };
    }
  });

  ipcMain.handle("get-audio-base64", async (_event, filePath: string) => {
    try {
      const audioBase64 = await deps.getAudioBase64(filePath);
      return { success: true, audioBase64 };
    } catch (error) {
      console.error("Error getting audio base64:", error);
      return { success: false, error: String(error), audioBase64: null };
    }
  });

  // Window management handlers
  ipcMain.handle("toggle-window", () => {
    try {
      deps.toggleMainWindow();
      // Reset mouse events when toggling window
      const mainWindow = deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.setIgnoreMouseEvents(false);
          mainWindow.setIgnoreMouseEvents(true, { forward: true });
        } catch (error) {
          console.error("[Mouse Events] Error resetting during toggle:", error);
        }
      }
      return { success: true };
    } catch (error) {
      console.error("Error toggling window:", error);
      return { error: "Failed to toggle window" };
    }
  });

  ipcMain.handle("reset-queues", async () => {
    try {
      deps.clearQueues();
      return { success: true };
    } catch (error) {
      console.error("Error resetting queues:", error);
      return { error: "Failed to reset queues" };
    }
  });

  // Process screenshot handlers
  ipcMain.handle("trigger-process-screenshots", async () => {
    try {
      await deps.processingHelper?.processScreenshots();
      return { success: true };
    } catch (error) {
      console.error("Error processing screenshots:", error);
      return { error: "Failed to process screenshots" };
    }
  });

  // Direct prompt processing handler
  ipcMain.handle("process-direct-prompt", async (_event, prompt: string) => {
    try {
      await deps.processingHelper?.processDirectPrompt(prompt);
      return { success: true };
    } catch (error) {
      console.error("Error processing direct prompt:", error);
      return { error: "Failed to process prompt" };
    }
  });

  // Reset handlers
  ipcMain.handle("trigger-reset", () => {
    try {
      deps.processingHelper?.resetProcessing();

      const mainWindow = deps.getMainWindow();

      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.setIgnoreMouseEvents(false);
          mainWindow.setIgnoreMouseEvents(true, { forward: true });
        } catch (error) {
          console.error(
            "[Mouse Events] Error resetting during app reset:",
            error
          );
        }

        // Send reset events in sequence
        mainWindow.webContents.send("reset-view");
        mainWindow.webContents.send("reset");
      }

      return { success: true };
    } catch (error) {
      console.error("Error triggering reset:", error);
      return { error: "Failed to trigger reset" };
    }
  });

  // Window movement handlers
  ipcMain.handle("trigger-move-left", () => {
    try {
      deps.moveWindowLeft();
      return { success: true };
    } catch (error) {
      console.error("Error moving window left:", error);
      return { error: "Failed to move window left" };
    }
  });

  ipcMain.handle("trigger-move-right", () => {
    try {
      deps.moveWindowRight();
      return { success: true };
    } catch (error) {
      console.error("Error moving window right:", error);
      return { error: "Failed to move window right" };
    }
  });

  ipcMain.handle("trigger-move-up", () => {
    try {
      deps.moveWindowUp();
      return { success: true };
    } catch (error) {
      console.error("Error moving window up:", error);
      return { error: "Failed to move window up" };
    }
  });

  ipcMain.handle("trigger-move-down", () => {
    try {
      deps.moveWindowDown();
      return { success: true };
    } catch (error) {
      console.error("Error moving window down:", error);
      return { error: "Failed to move window down" };
    }
  });

  // Window interaction handlers
  ipcMain.handle("set-ignore-mouse-events", () => {
    const mainWindow = deps.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        // Always set to ignore with forward enabled
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
        console.log("[Mouse Events] Set to ignore mode with forward");
        return { success: true };
      } catch (error) {
        console.error("[Mouse Events] Error setting ignore mode:", error);
        return { success: false, error: "Failed to set ignore mode" };
      }
    }
    return { success: false, error: "Main window not available" };
  });

  ipcMain.handle("set-interactive-mouse-events", () => {
    const mainWindow = deps.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        // Only disable ignore mode, no forward
        mainWindow.setIgnoreMouseEvents(false);
        console.log("[Mouse Events] Set to interactive mode");
        return { success: true };
      } catch (error) {
        console.error("[Mouse Events] Error setting interactive mode:", error);
        return { success: false, error: "Failed to set interactive mode" };
      }
    }
    return { success: false, error: "Main window not available" };
  });

  // Add window creation handler to ensure mouse events are always ignored by default
  const setInitialMouseEvents = (window: Electron.BrowserWindow) => {
    try {
      window.setIgnoreMouseEvents(true, { forward: true });
      console.log("[Mouse Events] Initial state set to ignore with forward");
    } catch (error) {
      console.error("[Mouse Events] Error setting initial state:", error);
    }
  };

  // Add the initialization to the window creation
  const originalCreateWindow = deps.createWindow;
  deps.createWindow = async () => {
    const window = await originalCreateWindow();
    setInitialMouseEvents(window);
    return window;
  };

  // Ensure mouse events are ignored after window is ready
  const mainWindow = deps.getMainWindow();
  if (mainWindow) {
    mainWindow.on("ready-to-show", () => {
      setInitialMouseEvents(mainWindow);
    });
  }

  // Custom prompt handler
  ipcMain.handle("set-custom-prompt", async (_event, customPrompt: string) => {
    try {
      const success = await setStoreValue("custom-prompt", customPrompt || "");
      
      if (!success) {
        console.error("Failed to save custom prompt to store.");
        return { success: false, error: "Failed to save custom prompt" };
      }

      return { success: true };
    } catch (error) {
      console.error("Error setting custom prompt:", error);
      return { success: false, error: "Failed to save custom prompt" };
    }
  });

  // Quit application handler
  ipcMain.handle("quit-application", async () => {
    try {
      console.log("Quit application requested via IPC");
      deps.quitApplication();
      return { success: true };
    } catch (error) {
      console.error("Error quitting application:", error);
      return { success: false, error: "Failed to quit application" };
    }
  });

  // Screen capture protection status
  ipcMain.handle("get-screen-protection-status", () => {
    try {
      // Access the screen capture helper through deps or main state
      const mainWindow = deps.getMainWindow();
      if (!mainWindow) {
        return { success: false, error: "No main window available", isActive: false };
      }
      
      // Since we don't have direct access to screenCaptureHelper in deps,
      // we'll check if the platform supports it and assume it's active if we got this far
      const supported = process.platform === "darwin";
      const isActive = supported; // If we got this far on macOS, protection should be active
      
      return {
        success: true,
        isActive,
        platform: process.platform,
        supported
      };
    } catch (error) {
      console.error("Error getting screen protection status:", error);
      return { success: false, error: String(error), isActive: false };
    }
  });

  // Microphone recording IPC handlers
  ipcMain.on("audio-data", (event, data) => {
    try {
      // Convert array back to Buffer
      const buffer = Buffer.from(data.buffer);
      console.log("Received audio data from renderer:", buffer.length, "bytes");
      
      // Send to the main process for processing
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send("audio-data", { buffer: Array.from(buffer) });
      }
    } catch (error) {
      console.error("Error handling audio data:", error);
    }
  });

  ipcMain.on("recording-complete", (event) => {
    try {
      console.log("Recording completed from renderer");
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send("recording-complete");
      }
    } catch (error) {
      console.error("Error handling recording complete:", error);
    }
  });

  ipcMain.on("recording-error", (event, error) => {
    try {
      console.error("Recording error from renderer:", error);
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send("recording-error", error);
      }
    } catch (error) {
      console.error("Error handling recording error:", error);
    }
  });
}
