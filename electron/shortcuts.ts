import { app, globalShortcut } from "electron";

import { IShortcutsHelperDeps } from "./main";

export class ShortcutsHelper {
  private deps: IShortcutsHelperDeps;
  private shortcuts: { [key: string]: () => void } = {};

  constructor(deps: IShortcutsHelperDeps) {
    this.deps = deps;

    // Define all shortcuts and their handlers
    this.shortcuts = {
      "CommandOrControl+Enter": async () => {
        try {
          await this.deps.takeScreenshot();
          await this.deps.processingHelper?.processScreenshots();
          return true;
        } catch (error) {
          console.error("Error processing screenshot:", error);
          return false;
        }
      },
      "CommandOrControl+R": () => {
        try {
          console.log(
            "Command + R pressed. Canceling requests and resetting queues..."
          );
          this.deps.processingHelper?.resetProcessing();
          console.log("Reset processing complete.");
          return true;
        } catch (error) {
          console.error("Error resetting:", error);
          return false;
        }
      },
      "CommandOrControl+Left": () => {
        try {
          console.log("Command/Ctrl + Left pressed. Moving window left.");
          this.deps.moveWindowLeft();
          return true;
        } catch (error) {
          console.error("Error moving window left:", error);
          return false;
        }
      },
      "CommandOrControl+Right": () => {
        try {
          console.log("Command/Ctrl + Right pressed. Moving window right.");
          this.deps.moveWindowRight();
          return true;
        } catch (error) {
          console.error("Error moving window right:", error);
          return false;
        }
      },
      "CommandOrControl+Down": () => {
        try {
          console.log("Command/Ctrl + down pressed. Moving window down.");
          this.deps.moveWindowDown();
          return true;
        } catch (error) {
          console.error("Error moving window down:", error);
          return false;
        }
      },
      "CommandOrControl+Up": () => {
        try {
          console.log("Command/Ctrl + Up pressed. Moving window Up.");
          this.deps.moveWindowUp();
          return true;
        } catch (error) {
          console.error("Error moving window up:", error);
          return false;
        }
      },
      "CommandOrControl+Q": () => {
        try {
          console.log("Command/Ctrl + Q pressed. Quitting application...");
          this.deps.quitApplication();
          return true;
        } catch (error) {
          console.error("Error quitting application:", error);
          return false;
        }
      },
    };
  }

  private registerAppShortcuts(): void {
    Object.entries(this.shortcuts).forEach(([key, handler]) => {
      globalShortcut.register(key, () => {
        try {
          handler();
          return true;
        } catch (error) {
          console.error(`Error handling shortcut ${key}:`, error);
          return false;
        }
      });
    });
  }

  private unregisterAppShortcuts(): void {
    Object.keys(this.shortcuts).forEach((key) => {
      globalShortcut.unregister(key);
    });
  }

  public registerGlobalShortcuts(): void {
    globalShortcut.register("CommandOrControl+\\", () => {
      try {
        const wasVisible = this.deps.isWindowUsable();
        this.deps.toggleMainWindow();

        if (wasVisible) {
          this.unregisterAppShortcuts();
        } else {
          this.registerAppShortcuts();
        }
        return true;
      } catch (error) {
        console.error("Error handling toggle shortcut:", error);
        return false;
      }
    });

    if (this.deps.isWindowUsable()) {
      this.registerAppShortcuts();
    }

    app.on("will-quit", () => {
      globalShortcut.unregisterAll();
    });
  }
}
