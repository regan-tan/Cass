import { BrowserWindow, app, screen } from "electron";

import { ProcessingHelper } from "./ProcessingHelper";
import { ScreenshotHelper } from "./ScreenshotHelper";
import { ShortcutsHelper } from "./shortcuts";
import { initializeIpcHandlers } from "./ipcHandlers";
import path from "path";

let store: any = null;

async function initializeStore() {
  try {
    const fs = await import("fs/promises");
    const userDataPath =
      process.env.APPDATA ||
      (process.platform === "darwin"
        ? path.join(process.env.HOME || "", "Library", "Application Support")
        : path.join(process.env.HOME || "", ".config"));

    const configPath = path.join(userDataPath, "ikiag", "config.json");

    store = {
      _configPath: configPath,
      get: async (key: string) => {
        try {
          await fs.access(configPath);
        } catch (error) {
          await fs.mkdir(path.dirname(configPath), { recursive: true });
          await fs.writeFile(configPath, JSON.stringify({}), "utf8");
          return undefined;
        }
        try {
          const data = await fs.readFile(configPath, "utf8");
          const config = JSON.parse(data || "{}");
          return config[key];
        } catch (readError) {
          console.error(
            `Error reading config file at ${configPath}:`,
            readError
          );
          // Attempt to reset if corrupted
          try {
            await fs.writeFile(configPath, JSON.stringify({}), "utf8");
          } catch (writeError) {
            console.error(
              `Failed to reset corrupted config file at ${configPath}:`,
              writeError
            );
          }
          return undefined;
        }
      },
      set: async (key: string, value: any) => {
        try {
          await fs.mkdir(path.dirname(configPath), { recursive: true });
          let config = {};
          try {
            const data = await fs.readFile(configPath, "utf8");
            config = JSON.parse(data || "{}");
          } catch (error) {
            /* Ignore if file doesn't exist */
          }
          config = { ...config, [key]: value };
          await fs.writeFile(
            configPath,
            JSON.stringify(config, null, 2),
            "utf8"
          );
          return true;
        } catch (error) {
          console.error(`Error setting ${key} in config:`, error);
          return false;
        }
      },
    };
    console.log("Config store initialized successfully.");
    return true;
  } catch (error) {
    console.error("Error initializing config store:", error);
    store = null; // Ensure store is null on error
    return false;
  }
}

export async function getStoreValue(key: string): Promise<any> {
  if (!store) {
    const initialized = await initializeStore();
    if (!initialized || !store) {
      console.error("Store access failed: Could not initialize store.");
      return undefined;
    }
  }
  return store.get(key);
}

export async function setStoreValue(key: string, value: any): Promise<boolean> {
  if (!store) {
    const initialized = await initializeStore();
    if (!initialized || !store) {
      console.error("Store access failed: Could not initialize store.");
      return false;
    }
  }
  return store.set(key, value);
}

interface ProcessingEvents {
  FOLLOW_UP_SUCCESS: string;
  FOLLOW_UP_ERROR: string;
  FOLLOW_UP_CHUNK: string;
  API_KEY_INVALID: string;
  INITIAL_START: string;
  RESPONSE_SUCCESS: string;
  INITIAL_RESPONSE_ERROR: string;
  FOLLOW_UP_START: string;
  RESPONSE_CHUNK: string;
  RESET: string;
}

interface State {
  mainWindow: BrowserWindow | null;
  isWindowVisible: boolean;
  windowPosition: { x: number; y: number } | null;
  windowSize: { width: number; height: number } | null;
  screenWidth: number;
  screenHeight: number;
  currentX: number;
  currentY: number;
  shortcutsHelper: any;
  hasFollowedUp: boolean;
  PROCESSING_EVENTS: ProcessingEvents;
  screenshotHelper: any;
  processingHelper: any;
  view: "initial" | "response" | "followup";
  step: number;
}

const state: State = {
  mainWindow: null,
  isWindowVisible: false,
  windowPosition: null,
  windowSize: null,
  screenWidth: 0,
  screenHeight: 0,
  currentX: 0,
  currentY: 0,
  shortcutsHelper: null,
  hasFollowedUp: false,
  screenshotHelper: null,
  processingHelper: null,
  view: "initial",
  step: 0,
  PROCESSING_EVENTS: {
    API_KEY_INVALID: "processing-api-key-invalid",
    INITIAL_START: "initial-start",
    RESPONSE_SUCCESS: "response-success",
    INITIAL_RESPONSE_ERROR: "response-error",
    FOLLOW_UP_START: "follow-up-start",
    FOLLOW_UP_SUCCESS: "follow-up-success",
    FOLLOW_UP_ERROR: "follow-up-error",
    FOLLOW_UP_CHUNK: "follow-up-chunk",
    RESPONSE_CHUNK: "response-chunk",
    RESET: "reset",
  },
};

// Add interfaces for helper classes
export interface IProcessingHelperDeps {
  getScreenshotHelper: () => ScreenshotHelper;
  getMainWindow: () => BrowserWindow | null;
  getView: () => "initial" | "response" | "followup";
  setView: (view: "initial" | "response" | "followup") => void;
  getConfiguredModel: () => Promise<string>;
  setHasFollowedUp: (hasFollowedUp: boolean) => void;
  clearQueues: () => void;
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS;
}

export interface IShortcutsHelperDeps {
  getMainWindow: () => BrowserWindow | null;
  takeScreenshot: () => Promise<string>;
  getImagePreview: (filepath: string) => Promise<string>;
  processingHelper: ProcessingHelper | null;
  clearQueues: () => void;
  setView: (view: "initial" | "response" | "followup") => void;
  isWindowUsable: () => boolean;
  toggleMainWindow: () => void;
  moveWindowLeft: () => void;
  moveWindowRight: () => void;
  moveWindowUp: () => void;
  moveWindowDown: () => void;
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS;
  setHasFollowedUp: (value: boolean) => void;
  getHasFollowedUp: () => boolean;
  getConfiguredModel: () => Promise<string>;
}

export interface initializeIpcHandlerDeps {
  getMainWindow: () => BrowserWindow | null;
  getScreenshotQueue: () => string[];
  getExtraScreenshotQueue: () => string[];
  processingHelper?: ProcessingHelper;
  setWindowDimensions: (width: number, height: number) => void;
  takeScreenshot: () => Promise<string>;
  toggleMainWindow: () => void;
  clearQueues: () => void;
  setView: (view: "initial" | "response" | "followup") => void;
  moveWindowLeft: () => void;
  moveWindowRight: () => void;
  moveWindowUp: () => void;
  moveWindowDown: () => void;
  getView: () => "initial" | "response" | "followup";
  createWindow: () => BrowserWindow;
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS;
  setHasFollowedUp: (value: boolean) => void;
}

// Initialize helpers
function initializeHelpers() {
  state.screenshotHelper = new ScreenshotHelper(state.view);
  state.processingHelper = new ProcessingHelper({
    getScreenshotHelper,
    getMainWindow,
    getView,
    setView,
    getScreenshotQueue,
    getExtraScreenshotQueue,
    clearQueues,
    takeScreenshot,
    setHasFollowedUp,
    getHasFollowedUp,
    PROCESSING_EVENTS: state.PROCESSING_EVENTS,
    getConfiguredModel,
  } as IProcessingHelperDeps);
  state.shortcutsHelper = new ShortcutsHelper({
    getMainWindow,
    takeScreenshot,
    processingHelper: state.processingHelper,
    clearQueues,
    setView,
    isWindowUsable,
    toggleMainWindow,
    moveWindowLeft: () =>
      moveWindowHorizontal((x) =>
        Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)
      ),
    moveWindowRight: () =>
      moveWindowHorizontal((x) =>
        Math.min(
          state.screenWidth - (state.windowSize?.width || 0) / 2,
          x + state.step
        )
      ),
    moveWindowUp: () => moveWindowVertical((y) => y - state.step),
    moveWindowDown: () => moveWindowVertical((y) => y + state.step),
    PROCESSING_EVENTS: state.PROCESSING_EVENTS,
    setHasFollowedUp,
    getHasFollowedUp,
    getConfiguredModel,
  } as IShortcutsHelperDeps);
}

// Window management functions
function createWindow(): BrowserWindow {
  if (state.mainWindow) {
    return state.mainWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workAreaSize;
  state.screenWidth = workArea.width;
  state.screenHeight = workArea.height;
  state.step = 60;
  state.currentY = 50;

  const windowSettings: Electron.BrowserWindowConstructorOptions = {
    height: 600,
    width: 800,
    x: state.currentX,
    y: 50,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      scrollBounce: true,
    },
    show: true,
    frame: false,
    transparent: true,
    fullscreenable: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    focusable: true,
    skipTaskbar: true,
    type: process.platform === "darwin" ? "panel" : "toolbar", // Use different types for better screenshot exclusion
    paintWhenInitiallyHidden: true,
    titleBarStyle: "hidden",
    enableLargerThanScreen: true,
    movable: true,
  };

  state.mainWindow = new BrowserWindow(windowSettings);

  // Ensure window starts non-interactive (click-through) immediately
  state.mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Add more detailed logging for window events
  state.mainWindow.webContents.on("did-finish-load", () => {
    console.log("Window finished loading");
    // Re-enable click-through after load
    state.mainWindow?.setIgnoreMouseEvents(true, { forward: true });
  });

  state.mainWindow.webContents.on("did-start-loading", () => {
    // Ensure click-through during loading
    state.mainWindow?.setIgnoreMouseEvents(true, { forward: true });
  });

  state.mainWindow.on("show", () => {
    // Ensure click-through when window is shown
    state.mainWindow?.setIgnoreMouseEvents(true, { forward: true });
  });

  state.mainWindow.on("ready-to-show", () => {
    // Ensure click-through when window is ready
    state.mainWindow?.setIgnoreMouseEvents(true, { forward: true });
  });

  state.mainWindow.webContents.on(
    "did-fail-load",
    async (event, errorCode, errorDescription) => {
      console.error("Window failed to load:", errorCode, errorDescription);
      // Always try to load the built files on failure
      console.log("Attempting to load built files...");
      setTimeout(() => {
        state.mainWindow
          ?.loadFile(path.join(__dirname, "../dist/index.html"))
          .catch((error) => {
            console.error("Failed to load built files on retry:", error);
          });
      }, 1000);
    }
  );

  // Load the app - always load from built files
  console.log("Loading application from built files...");
  if (app.isPackaged) {
    state.mainWindow.loadFile(path.join(__dirname, "../index.html"));
  } else {
    state.mainWindow.loadURL("http://localhost:54321");
  }

  // Configure window behavior
  state.mainWindow.webContents.setZoomFactor(1);

  // if (isDev) {
  //   state.mainWindow.webContents.openDevTools();
  // }

  // Enhanced screen capture resistance
  state.mainWindow.setContentProtection(true);

  state.mainWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
  });
  state.mainWindow.setAlwaysOnTop(true, "floating", 1);

  // Additional screen capture resistance settings
  if (process.platform === "darwin") {
    // Configure window to be excluded from screenshots while remaining visible
    state.mainWindow.setHiddenInMissionControl(true);
    state.mainWindow.setWindowButtonVisibility(false);
    state.mainWindow.setBackgroundColor("#00000000");

    // Prevent window from being included in window switcher
    state.mainWindow.setSkipTaskbar(true);

    // Disable window shadow - this is key for screenshot exclusion
    state.mainWindow.setHasShadow(false);

    // Set the window level to be above screenshots but not always on top of everything
    // Using 'floating' level which is typically excluded from system screenshots
    state.mainWindow.setAlwaysOnTop(true, "floating");
  }

  // Prevent the window from being captured by screen recording
  state.mainWindow.webContents.setBackgroundThrottling(false);
  state.mainWindow.webContents.setFrameRate(60);

  // Set up window listeners
  state.mainWindow.on("move", handleWindowMove);
  state.mainWindow.on("resize", handleWindowResize);
  state.mainWindow.on("closed", handleWindowClosed);

  // Initialize window state
  const bounds = state.mainWindow.getBounds();
  state.windowPosition = { x: bounds.x, y: bounds.y };
  state.windowSize = { width: bounds.width, height: bounds.height };
  state.currentX = bounds.x;
  state.currentY = bounds.y;
  state.isWindowVisible = true;

  return state.mainWindow;
}

function handleWindowMove(): void {
  if (!state.mainWindow) return;
  const bounds = state.mainWindow.getBounds();
  state.windowPosition = { x: bounds.x, y: bounds.y };
  state.currentX = bounds.x;
  state.currentY = bounds.y;
}

function handleWindowResize(): void {
  if (!state.mainWindow) return;
  const bounds = state.mainWindow.getBounds();
  state.windowSize = { width: bounds.width, height: bounds.height };
}

function handleWindowClosed(): void {
  state.mainWindow = null;
  state.isWindowVisible = false;
  state.windowPosition = null;
  state.windowSize = null;
}

// Window visibility functions
function hideMainWindow(): void {
  if (!state.mainWindow?.isDestroyed()) {
    const bounds = state.mainWindow.getBounds();
    state.windowPosition = { x: bounds.x, y: bounds.y };
    state.windowSize = { width: bounds.width, height: bounds.height };
    state.mainWindow.setIgnoreMouseEvents(true, { forward: true });
    state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
    state.mainWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
    state.mainWindow.setOpacity(0);
    state.mainWindow.hide();
    state.isWindowVisible = false;
  }
}

function showMainWindow(): void {
  if (!state.mainWindow?.isDestroyed()) {
    if (state.windowPosition && state.windowSize) {
      state.mainWindow.setBounds({
        ...state.windowPosition,
        ...state.windowSize,
      });
    }
    // Ensure window starts non-interactive (click-through)
    state.mainWindow.setIgnoreMouseEvents(true, { forward: true });
    state.mainWindow.setAlwaysOnTop(true, "floating");
    state.mainWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
    state.mainWindow.setContentProtection(true);
    state.mainWindow.setOpacity(0);

    // Use showInactive on macOS to prevent focus stealing
    if (process.platform === "darwin") {
      state.mainWindow.showInactive();
    } else {
      state.mainWindow.show();
    }

    state.mainWindow.setOpacity(1);
    state.isWindowVisible = true;
  }
}

function isWindowUsable(): boolean {
  return (
    state.isWindowVisible &&
    state.mainWindow?.isVisible() &&
    state.mainWindow?.getOpacity() > 0
  );
}

function toggleMainWindow(): void {
  state.isWindowVisible ? hideMainWindow() : showMainWindow();
}

// Window movement functions
function moveWindowHorizontal(updateFn: (x: number) => number): void {
  if (!state.mainWindow) return;
  state.currentX = updateFn(state.currentX);
  state.mainWindow.setPosition(
    Math.round(state.currentX),
    Math.round(state.currentY)
  );
}

function moveWindowVertical(updateFn: (y: number) => number): void {
  if (!state.mainWindow) return;

  const newY = updateFn(state.currentY);
  // Allow window to go 2/3 off screen in either direction
  const maxUpLimit = (-(state.windowSize?.height || 0) * 2) / 3;
  const maxDownLimit =
    state.screenHeight + ((state.windowSize?.height || 0) * 2) / 3;

  // Only update if within bounds
  if (newY >= maxUpLimit && newY <= maxDownLimit) {
    state.currentY = newY;
    state.mainWindow.setPosition(
      Math.round(state.currentX),
      Math.round(state.currentY)
    );
  }
}

// Window dimension functions
function setWindowDimensions(width: number, height: number): void {
  if (!state.mainWindow?.isDestroyed()) {
    const [currentX, currentY] = state.mainWindow.getPosition();
    const primaryDisplay = screen.getPrimaryDisplay();
    const workArea = primaryDisplay.workAreaSize;
    const maxWidth = Math.floor(workArea.width * 0.5);

    state.mainWindow.setBounds({
      x: Math.min(currentX, workArea.width - maxWidth),
      y: currentY,
      width: Math.min(width + 32, maxWidth),
      height: Math.ceil(height),
    });
  }
}

// Environment setup
async function loadEnvVariables() {
  try {
    // No longer using dotenv for API key
    // Instead, check if we have a stored API key in our config file
    // Read config using the new store functions
    const storedApiKey = await getStoreValue("api-key");
    const storedModel =
      (await getStoreValue("api-model")) || "gemini-2.0-flash"; // Default model

    if (storedApiKey && storedModel) {
      // Set generic environment variables
      process.env.API_PROVIDER = "gemini"; // Always use gemini
      process.env.API_KEY = storedApiKey;
      process.env.API_MODEL = storedModel;

      console.log(
        `API configuration loaded: Provider=gemini, Model=${storedModel}`
      );
    } else {
      console.log(
        "No API key found in user preferences. User will be prompted to enter one."
      );

      // Since we're going to prompt the user for the API key, we can set up a one-time
      // check to notify the renderer that the API key is missing
      const checkForApiKey = () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send("api-key-missing");
        }
      };

      // Check after a short delay to ensure the window is ready
      setTimeout(checkForApiKey, 1000);
    }

    console.log("Environment setup complete:", {
      API_PROVIDER: process.env.API_PROVIDER,
      API_KEY: process.env.API_KEY ? "exists" : "missing",
      API_MODEL: process.env.API_MODEL,
    });
  } catch (error) {
    console.error("Error loading environment variables:", error);
  }
}

// Initialize application
async function initializeApp() {
  try {
    await loadEnvVariables();
    initializeHelpers();
    initializeIpcHandlers({
      getMainWindow: () => state.mainWindow,
      setWindowDimensions,
      getScreenshotQueue: () =>
        state.screenshotHelper?.getScreenshotQueue() || [],
      getExtraScreenshotQueue: () =>
        state.screenshotHelper?.getExtraScreenshotQueue() || [],
      processingHelper: state.processingHelper,
      takeScreenshot: async () => {
        if (!state.screenshotHelper) return "";
        const screenshot = await state.screenshotHelper.takeScreenshot();
        return screenshot;
      },
      toggleMainWindow,
      clearQueues: () => state.screenshotHelper?.clearQueues() || {},
      setView: (view) => state.screenshotHelper?.setView(view) || {},
      moveWindowLeft: () =>
        moveWindowHorizontal((x) =>
          Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)
        ),
      moveWindowRight: () =>
        moveWindowHorizontal((x) =>
          Math.min(
            state.screenWidth - (state.windowSize?.width || 0) / 2,
            x + state.step
          )
        ),
      moveWindowUp: () => moveWindowVertical((y) => y - state.step),
      moveWindowDown: () => moveWindowVertical((y) => y + state.step),
      getView: () => state.screenshotHelper?.getView() || "initial",
      createWindow: () => {
        if (!state.mainWindow) {
          return createWindow();
        }
        return state.mainWindow;
      },
      PROCESSING_EVENTS: state.PROCESSING_EVENTS,
      setHasFollowedUp: (value) => {
        state.hasFollowedUp = value;
      },
    });
    await createWindow();
    state.shortcutsHelper?.registerGlobalShortcuts();
  } catch (error) {
    console.error("Failed to initialize application:", error);
    app.quit();
  }
}

// State getter/setter functions
function getMainWindow(): BrowserWindow | null {
  return state.mainWindow;
}

function getView(): "initial" | "response" | "followup" {
  return state.view;
}

function setView(view: "initial" | "response" | "followup"): void {
  state.view = view;
  state.screenshotHelper?.setView(view);
}

function getScreenshotHelper(): ScreenshotHelper | null {
  return state.screenshotHelper;
}

function getScreenshotQueue(): string[] {
  return state.screenshotHelper?.getScreenshotQueue() || [];
}

function getExtraScreenshotQueue(): string[] {
  return state.screenshotHelper?.getExtraScreenshotQueue() || [];
}

function clearQueues(): void {
  state.screenshotHelper?.clearQueues();
  setView("initial");
}

async function takeScreenshot(): Promise<string> {
  if (!state.mainWindow) throw new Error("No main window available");
  return state.screenshotHelper?.takeScreenshot() || "";
}

function setHasFollowedUp(value: boolean): void {
  state.hasFollowedUp = value;
}

function getHasFollowedUp(): boolean {
  return state.hasFollowedUp;
}

// Function to get the configured model from the store
async function getConfiguredModel(): Promise<string> {
  try {
    // Use the exported getter
    const model = (await getStoreValue("api-model")) || "gemini-2.0-flash";
    return model;
  } catch (error) {
    console.error("Error getting configured model from store:", error);
    return "gpt-4o"; // Return default on error
  }
}

// Export state and functions for other modules
export {
  state,
  createWindow,
  hideMainWindow,
  showMainWindow,
  toggleMainWindow,
  setWindowDimensions,
  moveWindowHorizontal,
  moveWindowVertical,
  getMainWindow,
  getView,
  setView,
  getScreenshotHelper,
  getScreenshotQueue,
  getExtraScreenshotQueue,
  clearQueues,
  takeScreenshot,
  setHasFollowedUp,
  getHasFollowedUp,
  getConfiguredModel,
  isWindowUsable,
};

app.whenReady().then(initializeApp);
