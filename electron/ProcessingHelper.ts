import { GoogleGenerativeAI } from "@google/generative-ai";
import { IProcessingHelperDeps } from "./main";
import { ScreenshotHelper } from "./ScreenshotHelper";
import fs from "node:fs";
import process from "process";

export class ProcessingHelper {
  private deps: IProcessingHelperDeps;
  private screenshotHelper: ScreenshotHelper;
  private isCurrentlyProcessing: boolean = false;

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null;
  private currentExtraProcessingAbortController: AbortController | null = null;

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps;
    this.screenshotHelper = deps.getScreenshotHelper();
  }

  public async processScreenshots(): Promise<void> {
    if (this.isCurrentlyProcessing) {
      console.log("Processing already in progress. Skipping duplicate call.");
      return;
    }

    this.isCurrentlyProcessing = true;
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;

    try {
      const view = this.deps.getView();
      console.log("Processing screenshots in view:", view);

      if (view === "initial") {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START);
        const screenshotQueue = this.screenshotHelper.getScreenshotQueue();
        console.log("Processing main queue screenshots:", screenshotQueue);
        try {
          // Initialize AbortController
          this.currentProcessingAbortController = new AbortController();
          const { signal } = this.currentProcessingAbortController;

          const screenshots = await Promise.all(
            screenshotQueue.map(async (path) => ({
              path,
              data: fs.readFileSync(path).toString("base64"),
            }))
          );

          const result = await this.processScreenshotsHelper(
            screenshots,
            signal
          );

          if (!result.success) {
            console.log("Processing failed:", result.error);
            if (result.error?.includes("API key not found")) {
              mainWindow.webContents.send(
                this.deps.PROCESSING_EVENTS.INITIAL_RESPONSE_ERROR,
                "API key not found. Please set your API key in settings."
              );
            } else {
              mainWindow.webContents.send(
                this.deps.PROCESSING_EVENTS.INITIAL_RESPONSE_ERROR,
                result.error
              );
            }
            // Reset view back to queue on error
            console.log("Resetting view to queue due to error");
            this.deps.setView("initial");
            return;
          }

          // Only set view to response if processing succeeded
          console.log("Setting view to response after successful processing");
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.RESPONSE_SUCCESS,
            { response: result.data }
          );
          this.deps.setView("response");
        } catch (error: any) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_RESPONSE_ERROR,
            error
          );
          console.error("Processing error:", error);
          if (error.message === "Request aborted") {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_RESPONSE_ERROR,
              "Processing was canceled by the user."
            );
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_RESPONSE_ERROR,
              error.message || "Server error. Please try again."
            );
          }
          // Reset view back to queue on error
          console.log("Resetting view to queue due to error");
          this.deps.setView("initial");
        } finally {
          this.currentProcessingAbortController = null;
        }
      } else {
        // view == 'response'
        const extraScreenshotQueue =
          this.screenshotHelper.getExtraScreenshotQueue();
        console.log(
          "Processing extra queue screenshots:",
          extraScreenshotQueue
        );
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.FOLLOW_UP_START
        );

        // Initialize AbortController
        this.currentExtraProcessingAbortController = new AbortController();
        const { signal } = this.currentExtraProcessingAbortController;

        try {
          const screenshots = await Promise.all(
            [
              ...this.screenshotHelper.getScreenshotQueue(),
              ...extraScreenshotQueue,
            ].map(async (path) => ({
              path,
              data: fs.readFileSync(path).toString("base64"),
            }))
          );
          console.log(
            "Combined screenshots for processing:",
            screenshots.map((s) => s.path)
          );

          const result = await this.processExtraScreenshotsHelper(
            screenshots,
            signal
          );

          if (result.success) {
            this.deps.setHasFollowedUp(true);
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.FOLLOW_UP_SUCCESS,
              { response: result.data }
            );
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.FOLLOW_UP_ERROR,
              result.error
            );
          }
        } catch (error: any) {
          if (error.message === "Request aborted") {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.FOLLOW_UP_ERROR,
              "Extra processing was canceled by the user."
            );
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.FOLLOW_UP_ERROR,
              error.message
            );
          }
        } finally {
          this.currentExtraProcessingAbortController = null;
        }
      }
    } finally {
      this.isCurrentlyProcessing = false; // Ensure flag is reset
      console.log("Processing finished. Resetting isCurrentlyProcessing flag.");
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    const MAX_RETRIES = 0;
    let retryCount = 0;

    while (retryCount <= MAX_RETRIES) {
      try {
        const imageDataList = screenshots.map((screenshot) => screenshot.data);
        const mainWindow = this.deps.getMainWindow();

        // Get configured provider and API key from environment
        const provider = process.env.API_PROVIDER || "gemini";
        const apiKey = process.env.API_KEY;

        // Get model directly from config store via deps
        const model = await this.deps.getConfiguredModel();

        if (!apiKey) {
          throw new Error(
            "API key not found. Please configure it in settings."
          );
        }

        console.log(
          `Processing screenshots with provider: ${provider}, model: ${model}`
        );

        const base64Images = imageDataList.map(
          (data) => data // Keep the base64 string as is
        );

        if (mainWindow) {
          // Generate response directly using images
          const responseResult = await this.generateResponseWithImages(
            signal,
            base64Images,
            apiKey,
            model
          );

          if (responseResult.success) {
            this.screenshotHelper.clearExtraScreenshotQueue();
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.RESPONSE_SUCCESS,
              { response: responseResult.data }
            );
            return { success: true, data: responseResult.data };
          } else {
            throw new Error(
              responseResult.error || "Failed to generate response"
            );
          }
        }
      } catch (error: any) {
        console.error("Processing error details:", {
          message: error.message,
          code: error.code,
          response: error.response?.data,
          retryCount,
        });

        if (
          error.message === "Request aborted" ||
          error.name === "AbortError" ||
          retryCount >= MAX_RETRIES
        ) {
          return { success: false, error: error.message };
        }
        retryCount++;
      }
    }

    return {
      success: false,
      error: "Failed to process after multiple attempts. Please try again.",
    };
  }

  private async generateResponseWithImages(
    signal: AbortSignal,
    base64Images: string[],
    apiKey: string,
    model: string
  ) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModelId = model.startsWith("gemini-")
        ? `models/${model}`
        : model;
      const geminiModel = genAI.getGenerativeModel({ model: geminiModelId });

      const imageParts = base64Images.map((data) => ({
        inlineData: {
          mimeType: "image/png",
          data: data,
        },
      }));

      const promptLines = [
        `You are an expert assistant tasked with solving the task shown in the images.`,
        ``,
        `---`,
        `Your response MUST follow this structure, using Markdown headings:`,
        ``,
        `# Analysis`,
        `Keep this extremely brief. DO NOT describe the task itself, just focus on your solution approach. One or two sentences maximum.`,
        ``,
        `# Solution`,
        `Provide the direct solution. Use standard Markdown. If code is necessary, use appropriate code blocks. Do not describe the task itself.`,
        `IMPORTANT: When adding code blocks, use triple backticks WITH the language specifier. Use \`\`\`language\\ncode here\\n\`\`\`.`,
        ``,
        `# Summary`,
        `Provide only 1-2 sentences focusing on implementation details. No conclusions or verbose explanations.`,
        ``,
        `---`,
        `Remember: Focus on the solution itself, not describing the task or providing extensive conclusions.`,
        `CODE FORMATTING: Use ONLY \`\`\` WITH the language specifier for all code blocks.`,
      ];
      const prompt = promptLines.join("\n");

      if (signal.aborted) throw new Error("Request aborted");
      const abortHandler = () => {
        throw new Error("Request aborted");
      };
      signal.addEventListener("abort", abortHandler);

      let responseText = "";
      const mainWindow = this.deps.getMainWindow();

      try {
        // Stream the response with controlled pace
        const result = await geminiModel.generateContentStream([
          prompt,
          ...imageParts,
        ]);

        let accumulatedText = "";
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          accumulatedText += chunkText;

          // Send chunk to UI for live markdown rendering
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.RESPONSE_CHUNK,
              { response: accumulatedText }
            );
          }
        }

        responseText = accumulatedText;

        // Send final success message
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.RESPONSE_SUCCESS,
            { response: responseText }
          );
        }
      } finally {
        signal.removeEventListener("abort", abortHandler);
      }

      console.log("API response completed, total length:", responseText.length);

      return { success: true, data: responseText };
    } catch (error: any) {
      const mainWindow = this.deps.getMainWindow();
      console.error("Response generation error:", {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      });

      if (error.message === "Request aborted" || error.name === "AbortError") {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_RESPONSE_ERROR,
            "Response generation canceled."
          );
        }
        return { success: false, error: "Response generation canceled." };
      }

      if (error.code === "ETIMEDOUT" || error.response?.status === 504) {
        this.cancelOngoingRequests();
        this.deps.clearQueues();
        this.deps.setView("initial");
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("reset-view");
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_RESPONSE_ERROR,
            "Request timed out. The server took too long to respond. Please try again."
          );
        }
        return {
          success: false,
          error: "Request timed out. Please try again.",
        };
      }

      if (
        error.response?.data?.error?.includes(
          "Please close this window and re-enter a valid Open AI API key."
        ) ||
        error.response?.data?.error?.includes("API key not found")
      ) {
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.API_KEY_INVALID
          );
        }
        return { success: false, error: error.response.data.error };
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_RESPONSE_ERROR,
          error.message ||
            "Server error during response generation. Please try again."
        );
      }
      console.log("Resetting view to queue due to response generation error");
      this.deps.setView("initial");
      return {
        success: false,
        error: error.message || "Unknown error during response generation",
      };
    }
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const imageDataList = screenshots.map((screenshot) => screenshot.data);
      const mainWindow = this.deps.getMainWindow();

      // Get configured provider and API key from environment
      const provider = process.env.API_PROVIDER || "gemini";
      const apiKey = process.env.API_KEY;

      // Get model directly from config store via deps
      const model = await this.deps.getConfiguredModel();

      if (!apiKey) {
        throw new Error("API key not found. Please configure it in settings.");
      }

      console.log(
        `Processing follow-up screenshots with provider: ${provider}, model: ${model}`
      );

      const base64Images = imageDataList.map(
        (data) => data // Keep the base64 string as is
      );

      // For follow-up, use the same approach as the initial response, including analysis/summary
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModelId = model.startsWith("gemini-")
        ? `models/${model}`
        : model;
      const geminiModel = genAI.getGenerativeModel({ model: geminiModelId });

      const imageParts = base64Images.map((data) => ({
        inlineData: {
          mimeType: "image/png",
          data: data,
        },
      }));

      const promptLines = [
        `You are an expert assistant tasked with solving the follow-up issue shown in the images.`,
        ``,
        `---`,
        `Your response MUST follow this structure, using Markdown headings:`,
        ``,
        `# Analysis`,
        `Keep this extremely brief. DO NOT describe the task itself, just focus on your solution approach. One or two sentences maximum.`,
        ``,
        `# Solution`,
        `Provide the direct solution. Use standard Markdown. If code is necessary, use appropriate code blocks. Do not describe the task itself.`,
        `IMPORTANT: When adding code blocks, use triple backticks WITH the language specifier. Use \`\`\`language\\ncode here\\n\`\`\`.`,
        ``,
        `# Summary`,
        `Provide only 1-2 sentences focusing on implementation details. No conclusions or verbose explanations.`,
        ``,
        `---`,
        `Remember: Focus on the solution itself, not describing the task or providing extensive conclusions.`,
        `CODE FORMATTING: Use ONLY \`\`\` WITH the language specifier for all code blocks.`,
      ];
      const prompt = promptLines.join("\n");

      if (signal.aborted) throw new Error("Request aborted");
      const abortHandler = () => {
        throw new Error("Request aborted");
      };
      signal.addEventListener("abort", abortHandler);

      let followUpResponse = "";

      try {
        // Stream the follow-up response with controlled pace
        const result = await geminiModel.generateContentStream([
          prompt,
          ...imageParts,
        ]);

        let accumulatedText = "";
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          accumulatedText += chunkText;

          // Send chunk to UI for live markdown rendering
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.FOLLOW_UP_CHUNK,
              { response: accumulatedText }
            );
          }
        }

        followUpResponse = accumulatedText;

        // Send final success message
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.FOLLOW_UP_SUCCESS,
            { response: followUpResponse }
          );
        }
      } finally {
        signal.removeEventListener("abort", abortHandler);
      }

      console.log(
        "API response completed for follow-up, total length:",
        followUpResponse.length
      );

      return { success: true, data: followUpResponse };
    } catch (error: any) {
      console.error("Follow-up processing error details:", {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      });

      if (error.message === "Request aborted" || error.name === "AbortError") {
        return { success: false, error: "Follow-up processing canceled." };
      }

      if (error.code === "ETIMEDOUT" || error.response?.status === 504) {
        this.cancelOngoingRequests();
        this.deps.clearQueues();
        return {
          success: false,
          error: "Request timed out. Please try again.",
        };
      }

      return {
        success: false,
        error: error.message || "Unknown error during follow-up processing",
      };
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false;

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort();
      this.currentProcessingAbortController = null;
      wasCancelled = true;
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort();
      this.currentExtraProcessingAbortController = null;
      wasCancelled = true;
    }

    this.deps.setHasFollowedUp(false);

    const mainWindow = this.deps.getMainWindow();

    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.RESET);
    }
  }

  public cancelProcessing(): void {
    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort();
      this.currentProcessingAbortController = null;
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort();
      this.currentExtraProcessingAbortController = null;
    }
  }

  public isProcessing(): boolean {
    return this.isCurrentlyProcessing;
  }
}
