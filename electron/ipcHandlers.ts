import { getStoreValue, setStoreValue } from "./main";

import { initializeIpcHandlerDeps } from "./main";
import { ipcMain } from "electron";

export function initializeIpcHandlers(deps: initializeIpcHandlerDeps): void {
  console.log("Initializing IPC handlers");

  ipcMain.handle("get-api-config", async () => {
    try {
      const apiKey = await getStoreValue("api-key");
      const model = (await getStoreValue("api-model")) || "gemini-2.0-flash";

      if (!apiKey) {
        return { success: false, error: "API key not found" };
      }

      return { success: true, apiKey, model };
    } catch (error) {
      console.error("Error getting API config:", error);
      return { success: false, error: "Failed to retrieve API config" };
    }
  });

  // New handler for generic API configuration
  ipcMain.handle(
    "set-api-config",
    async (_event, config: { apiKey: string; model: string }) => {
      try {
        const { apiKey, model } = config;

        if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
          return { success: false, error: "Invalid API key" };
        }

        if (!model || typeof model !== "string") {
          return { success: false, error: "Invalid model selection" };
        }

        // Store the configuration using imported function
        const successKey = await setStoreValue("api-key", apiKey.trim());
        const successModel = await setStoreValue("api-model", model);

        if (!successKey || !successModel) {
          console.error(
            "Failed to save one or more API config values to store."
          );
          // Optionally return an error, but setting env vars might still be useful
        }

        // Set environment variables based on provider
        process.env.API_KEY = apiKey.trim();
        process.env.MODEL = model;

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
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        deps.setWindowDimensions(width, height);
      }
    }
  );

  ipcMain.handle(
    "set-window-dimensions",
    (event, width: number, height: number) => {
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
    deps.processingHelper?.cancelProcessing();
    return { success: true };
  });

  // Audio recording handlers
  ipcMain.handle("start-audio-recording", async () => {
    try {
      const result = await deps.startRecording();
      return { success: true, ...result };
    } catch (error) {
      console.error("Error starting audio recording:", error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle("stop-audio-recording", async () => {
    try {
      const result = await deps.stopRecording();
      return { success: true, ...result };
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

  // Reset handlers
  ipcMain.handle("trigger-reset", () => {
    try {
      deps.processingHelper?.cancelOngoingRequests();
      deps.clearQueues();
      deps.setView("initial");

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
  deps.createWindow = () => {
    const window = originalCreateWindow();
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
}
