console.log("Preload script starting...");

import { contextBridge, ipcRenderer } from "electron";

// Types for the exposed Electron API
interface ElectronAPI {
  updateContentDimensions: (dimensions: {
    width: number;
    height: number;
  }) => Promise<void>;
  clearStore: () => Promise<{ success: boolean; error?: string }>;
  // process
  getScreenshots: () => Promise<{
    success: boolean;
    previews?: Array<{ path: string; preview: string }> | null;
    error?: string;
  }>;
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void;
  onResetView: (callback: () => void) => () => void;
  onResponseStart: (callback: () => void) => () => void;
  onFollowUpStart: (callback: () => void) => () => void;
  onFollowUpSuccess: (callback: (data: any) => void) => () => void;
  onResponseError: (callback: (error: string) => void) => () => void;
  onResponseSuccess: (callback: (data: any) => void) => () => void;
  onFollowUpError: (callback: (error: string) => void) => () => void;
  onResponseChunk: (callback: (chunk: string) => void) => () => void;
  // shortcuts
  toggleMainWindow: () => Promise<{ success: boolean; error?: string }>;
  triggerScreenshot: () => Promise<{ success: boolean; error?: string }>;
  triggerReset: () => Promise<{ success: boolean; error?: string }>;
  // movement
  triggerMoveLeft: () => Promise<{ success: boolean; error?: string }>;
  triggerMoveRight: () => Promise<{ success: boolean; error?: string }>;
  triggerMoveUp: () => Promise<{ success: boolean; error?: string }>;
  triggerMoveDown: () => Promise<{ success: boolean; error?: string }>;
  // helper
  getPlatform: () => string;
  getStoreValue: (key: string) => Promise<any>;
  setStoreValue: (key: string, value: any) => Promise<void>;
  setApiConfig: (config: {
    apiKey: string;
    model: string;
  }) => Promise<{ success: boolean; error?: string }>;
  getApiConfig: () => Promise<{
    success: boolean;
    apiKey?: string;
    model?: string;
    provider?: string;
    error?: string;
  }>;
  onApiKeyUpdated: (callback: () => void) => () => void;
  onApiKeyMissing: (callback: () => void) => () => void;
  setIgnoreMouseEvents: () => Promise<{ success: boolean; error?: string }>;
  setInteractiveMouseEvents: () => Promise<{
    success: boolean;
    error?: string;
  }>;
  // Audio recording
  startAudioRecording: () => Promise<{ success: boolean; error?: string }>;
  stopAudioRecording: () => Promise<{
    success: boolean;
    recording?: any;
    error?: string;
  }>;
  getAudioRecordingStatus: () => Promise<{
    success: boolean;
    isRecording: boolean;
    recording?: any;
    error?: string;
  }>;
  getAudioBase64: (filePath: string) => Promise<{
    success: boolean;
    audioBase64?: string;
    error?: string;
  }>;
  quitApplication: () => Promise<{ success: boolean; error?: string }>;
}

export const PROCESSING_EVENTS = {
  // states for generating the initial solution
  INITIAL_START: "initial-start",
  RESPONSE_SUCCESS: "response-success",
  INITIAL_RESPONSE_ERROR: "response-error",
  RESET: "reset",
  RESPONSE_CHUNK: "response-chunk",

  // states for processing the debugging
  FOLLOW_UP_START: "follow-up-start",
  FOLLOW_UP_SUCCESS: "follow-up-success",
  FOLLOW_UP_ERROR: "follow-up-error",
  FOLLOW_UP_CHUNK: "follow-up-chunk",
} as const;

console.log("Preload script is running");

const electronAPI = {
  updateContentDimensions: (dimensions: { width: number; height: number }) =>
    ipcRenderer.invoke("update-content-dimensions", dimensions),
  clearStore: () => ipcRenderer.invoke("clear-store"),
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  toggleMainWindow: async () => {
    console.log("toggleMainWindow called from preload");
    try {
      const result = await ipcRenderer.invoke("toggle-window");
      console.log("toggle-window result:", result);
      return result;
    } catch (error) {
      console.error("Error in toggleMainWindow:", error);
      throw error;
    }
  },
  // Event listeners
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => {
    const subscription = (_: any, data: { path: string; preview: string }) =>
      callback(data);
    ipcRenderer.on("screenshot-taken", subscription);
    return () => {
      ipcRenderer.removeListener("screenshot-taken", subscription);
    };
  },
  onResetView: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on("reset-view", subscription);
    return () => {
      ipcRenderer.removeListener("reset-view", subscription);
    };
  },
  onResponseStart: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_START, subscription);
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.INITIAL_START, subscription);
    };
  },
  onFollowUpStart: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on(PROCESSING_EVENTS.FOLLOW_UP_START, subscription);
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.FOLLOW_UP_START,
        subscription
      );
    };
  },
  onFollowUpSuccess: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on(PROCESSING_EVENTS.FOLLOW_UP_SUCCESS, subscription);
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.FOLLOW_UP_SUCCESS,
        subscription
      );
    };
  },
  onFollowUpError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error);
    ipcRenderer.on(PROCESSING_EVENTS.FOLLOW_UP_ERROR, subscription);
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.FOLLOW_UP_ERROR,
        subscription
      );
    };
  },
  onFollowUpChunk: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on(PROCESSING_EVENTS.FOLLOW_UP_CHUNK, subscription);
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.FOLLOW_UP_CHUNK,
        subscription
      );
    };
  },
  onResponseError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error);
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_RESPONSE_ERROR, subscription);
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.INITIAL_RESPONSE_ERROR,
        subscription
      );
    };
  },
  onResponseSuccess: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on(PROCESSING_EVENTS.RESPONSE_SUCCESS, subscription);
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.RESPONSE_SUCCESS,
        subscription
      );
    };
  },
  triggerScreenshot: () => ipcRenderer.invoke("trigger-screenshot"),
  triggerReset: () => ipcRenderer.invoke("trigger-reset"),
  triggerMoveLeft: () => ipcRenderer.invoke("trigger-move-left"),
  triggerMoveRight: () => ipcRenderer.invoke("trigger-move-right"),
  triggerMoveUp: () => ipcRenderer.invoke("trigger-move-up"),
  triggerMoveDown: () => ipcRenderer.invoke("trigger-move-down"),
  startUpdate: () => ipcRenderer.invoke("start-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateAvailable: (callback: (info: any) => void) => {
    const subscription = (_: any, info: any) => callback(info);
    ipcRenderer.on("update-available", subscription);
    return () => {
      ipcRenderer.removeListener("update-available", subscription);
    };
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    const subscription = (_: any, info: any) => callback(info);
    ipcRenderer.on("update-downloaded", subscription);
    return () => {
      ipcRenderer.removeListener("update-downloaded", subscription);
    };
  },
  getPlatform: () => process.platform,
  getStoreValue: (key: string) => ipcRenderer.invoke("get-store-value", key),
  setStoreValue: (key: string, value: any) =>
    ipcRenderer.invoke("set-store-value", key, value),
  setApiConfig: (config: { apiKey: string; model: string }) =>
    ipcRenderer.invoke("set-api-config", config),
  getApiConfig: () => ipcRenderer.invoke("get-api-config"),
  onApiKeyUpdated: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on("api-key-updated", subscription);
    return () => {
      ipcRenderer.removeListener("api-key-updated", subscription);
    };
  },
  onApiKeyMissing: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on("api-key-missing", subscription);
    return () => ipcRenderer.removeListener("api-key-missing", subscription);
  },
  setIgnoreMouseEvents: () => ipcRenderer.invoke("set-ignore-mouse-events"),
  setInteractiveMouseEvents: () =>
    ipcRenderer.invoke("set-interactive-mouse-events"),
  // Audio recording methods
  startAudioRecording: () => ipcRenderer.invoke("start-audio-recording"),
  stopAudioRecording: () => ipcRenderer.invoke("stop-audio-recording"),
  getAudioRecordingStatus: () =>
    ipcRenderer.invoke("get-audio-recording-status"),
  getAudioBase64: (filePath: string) =>
    ipcRenderer.invoke("get-audio-base64", filePath),
  quitApplication: () => ipcRenderer.invoke("quit-application"),
  onResponseChunk: (callback: (chunk: string) => void) => {
    const subscription = (_: any, chunk: string) => callback(chunk);
    ipcRenderer.on(PROCESSING_EVENTS.RESPONSE_CHUNK, subscription);
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.RESPONSE_CHUNK,
        subscription
      );
    };
  },
} as ElectronAPI;

// Before exposing the API
console.log(
  "About to expose electronAPI with methods:",
  Object.keys(electronAPI)
);

// Add this focus restoration handler
window.addEventListener("focus", () => {
  console.log("Window focused");
});

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Expose platform info
contextBridge.exposeInMainWorld("platform", process.platform);

// Log that preload is complete
console.log("Preload script completed");
