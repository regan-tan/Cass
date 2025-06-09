import { GoogleGenerativeAI } from "@google/generative-ai";
import { IProcessingHelperDeps } from "./main";
import { ScreenshotHelper } from "./ScreenshotHelper";
import fs from "node:fs";
import process from "process";

export class ProcessingHelper {
  private deps: IProcessingHelperDeps;
  private screenshotHelper: ScreenshotHelper;
  private isCurrentlyProcessing: boolean = false;

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
          const screenshots = await Promise.all(
            screenshotQueue.map(async (path) => ({
              path,
              data: fs.readFileSync(path).toString("base64"),
            }))
          );

          const result = await this.processScreenshotsHelper(screenshots);

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
          console.error("Processing error:", error);
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_RESPONSE_ERROR,
            error.message || "Server error. Please try again."
          );
          // Reset view back to queue on error
          console.log("Resetting view to queue due to error");
          this.deps.setView("initial");
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

          const result = await this.processExtraScreenshotsHelper(screenshots);

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
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.FOLLOW_UP_ERROR,
            error.message
          );
        }
      }
    } finally {
      this.isCurrentlyProcessing = false;
      console.log("Processing finished. Resetting isCurrentlyProcessing flag.");
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>
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

        const base64Images = imageDataList.map((data) => data);

        if (mainWindow) {
          const responseResult = await this.generateResponseWithImages(
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

        if (retryCount >= MAX_RETRIES) {
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

      const contentParts = [...imageParts];
      console.log(
        `[PROCESSING] Images added to contentParts: ${imageParts.length}`
      );

      const audioHelper = this.deps.getAudioHelper();
      let hasAudioInstructions = false;

      if (audioHelper) {
        const recordingStatus = audioHelper.getRecordingStatus();
        if (recordingStatus.isRecording && recordingStatus.recording) {
          try {
            const audioFilePath =
              await audioHelper.saveCurrentRecordingForProcessing();
            if (audioFilePath) {
              const audioBase64 = await audioHelper.getAudioBase64(
                audioFilePath
              );
              if (audioBase64) {
                hasAudioInstructions = true;
                console.log(
                  `[AUDIO] Audio data available - Base64 length: ${audioBase64.length} characters`
                );

                contentParts.push({
                  inlineData: {
                    mimeType: "audio/wav",
                    data: audioBase64,
                  },
                });

                console.log(
                  `[AUDIO] Audio added to contentParts as multimodal input`
                );
                console.log(
                  `[PROCESSING] Total contentParts: ${contentParts.length} (${imageParts.length} images + 1 audio)`
                );
              } else {
                console.log(
                  `[AUDIO WARNING] Audio file found but Base64 conversion failed`
                );
              }
            } else {
              console.log(`[AUDIO WARNING] No audio file path available`);
            }
          } catch (error) {
            console.error(
              "[AUDIO ERROR] Error getting audio data for prompt:",
              error
            );
          }
        } else {
          console.log(`[AUDIO INFO] No audio recording available`);
        }
      } else {
        console.log(`[AUDIO INFO] Audio helper not available`);
      }

      const promptLines = [];

      if (hasAudioInstructions) {
        const recordingStatus = audioHelper!.getRecordingStatus();
        const recordingModeText =
          recordingStatus.recording!.recordingMode === "mixed"
            ? "both system audio and microphone input"
            : recordingStatus.recording!.recordingMode === "microphone-only"
            ? "microphone input only"
            : "system audio only";

        promptLines.push(
          `You are an expert assistant that analyzes visual content and executes audio instructions with intelligence and initiative.`,
          ``,
          `## Audio Instructions Analysis`,
          ``,
          `You have ${Math.round(
            (recordingStatus.recording!.duration || 0) / 1000
          )} seconds of recorded audio (${recordingModeText}) containing instructions or commands.`,
          ``,
          `**CRITICAL INSTRUCTIONS:**`,
          `1. **PRIORITIZE THE LATEST/MOST RECENT** audio content - focus on commands given toward the end of the recording`,
          `2. **BE PROACTIVE AND INTELLIGENT** - if audio is unclear, use context clues to infer intent (e.g., "Ustate" likely means "useState", "optimze" means "optimize")`,
          `3. **NEVER GIVE UP** - always provide a helpful response even if audio is unclear. Make educated guesses based on visual content and partial audio`,
          `4. **EXECUTE, DON'T JUST DESCRIBE** - perform the requested action rather than explaining what was asked`,
          `5. **USE VISUAL CONTEXT** - combine what you see in the images with audio commands for better understanding`,
          `6. **EXPERTISE DEMONSTRATION** - for concept questions, algorithms, or technical topics, provide comprehensive explanations that demonstrate deep technical knowledge and expertise to convince an interviewer of your competence`,
          ``,
          `**CONCEPT DETECTION & EXPERTISE MODE:**`,
          `- If the request involves explaining concepts (e.g., "what is useState", "explain closures", "how does quicksort work")`,
          `- If it's about algorithms, data structures, programming fundamentals, or theoretical topics`,
          `- If it's educational content like LeetCode problems, tutorials, or learning materials`,
          ``,
          `**THEN PROVIDE EXPERT-LEVEL EXPLANATIONS INCLUDING:**`,
          `- Precise technical definitions with proper terminology`,
          `- Deep understanding of underlying mechanisms and implementation details`,
          `- Multiple sophisticated examples showing mastery`,
          `- Advanced use cases and real-world production scenarios`,
          `- Performance implications, time/space complexity analysis`,
          `- Edge cases, limitations, and trade-offs`,
          `- Connections to related advanced concepts and design patterns`,
          `- Industry best practices and architectural considerations`,
          `- Common interview follow-up questions and their answers`,
          ``,
          `Make explanations demonstrate such thorough expertise that an interviewer would be convinced of deep technical competence.`,
          ``,
          `If the audio contains multiple requests, prioritize the most recent ones. If pronunciation is unclear, use the visual content to help interpret the intent.`,
          ``
        );
      } else {
        promptLines.push(
          `You are an expert assistant that analyzes visual content and provides intelligent, proactive solutions.`,
          ``,
          `## Visual Analysis Task`,
          ``,
          `No audio instructions were provided. Analyze the visual content and provide the most helpful response based on what you observe.`,
          ``,
          `**APPROACH:**`,
          `1. **IDENTIFY THE CONTEXT** - understand what's shown in the image (code, UI, document, etc.)`,
          `2. **INFER THE LIKELY NEED** - based on visual context, determine what assistance would be most valuable`,
          `3. **BE PROACTIVE** - provide solutions for common issues, improvements, or explanations related to what's visible`,
          `4. **PRIORITIZE ACTIONABLE HELP** - focus on practical solutions rather than just descriptions`,
          `5. **EXPERTISE DEMONSTRATION** - if visual content suggests learning or concept exploration, provide comprehensive explanations that showcase deep technical knowledge`,
          ``,
          `**EDUCATIONAL CONTENT DETECTION:**`,
          `- If the visual shows educational materials, documentation, or learning resources`,
          `- If it appears to be concept exploration, algorithm study, or programming fundamentals`,
          `- If it's code that demonstrates specific patterns, data structures, or theoretical concepts`,
          ``,
          `**THEN PROVIDE EXPERT-LEVEL EXPLANATIONS INCLUDING:**`,
          `- Precise technical definitions with proper terminology`,
          `- Deep understanding of underlying mechanisms and implementation details`,
          `- Multiple sophisticated examples showing mastery`,
          `- Advanced use cases and real-world production scenarios`,
          `- Performance implications, time/space complexity analysis`,
          `- Edge cases, limitations, and trade-offs`,
          `- Connections to related advanced concepts and design patterns`,
          `- Industry best practices and architectural considerations`,
          `- Common interview follow-up questions and their answers`,
          ``,
          `Make explanations demonstrate such thorough expertise that an interviewer would be convinced of deep technical competence.`,
          ``
        );
      }

      promptLines.push(
        `---`,
        `Your response MUST follow this structured, interview-style format using Markdown:`,
        ``,
        `# Analysis`,
        hasAudioInstructions
          ? `**Context Understanding:** Briefly reference what you understand from the audio (including any intelligent interpretation of unclear speech) and how it relates to the visual content. If this is a concept/educational request, mention your teaching approach. Be concise but demonstrate comprehension.`
          : `**Context Understanding:** Briefly analyze the visual content and identify the most valuable assistance you can provide. If this appears to be educational content, mention your explanation approach. Show clear analytical thinking.`,
        ``,
        `# Solution`,
        `**For Educational/Concept Questions:**`,
        `- **Core Concept:** Start with a precise technical definition`,
        `- **Deep Dive:** Explain underlying mechanisms and implementation details`,
        `- **Advanced Examples:** Provide sophisticated code examples with explanations`,
        `- **Real-World Applications:** Show enterprise-level usage scenarios`,
        `- **Performance & Trade-offs:** Discuss time/space complexity, limitations, and alternatives`,
        `- **Best Practices:** Share industry standards and professional recommendations`,
        `- **Interview Insights:** Cover common follow-up questions and advanced considerations`,
        ``,
        `**For Implementation Tasks:**`,
        hasAudioInstructions
          ? `Execute the audio instructions with intelligence and initiative. If speech was unclear, use your best interpretation combined with visual context. Provide direct solutions with clear explanations of your approach.`
          : `Provide the most helpful solution based on the visual content. Anticipate likely needs and provide actionable assistance with clear implementation steps.`,
        ``,
        `**Structure your technical explanations like you're demonstrating expertise to a senior interviewer:**`,
        `- Use precise technical terminology`,
        `- Show understanding of edge cases and pitfalls`,
        `- Demonstrate awareness of production considerations`,
        `- Connect concepts to broader architectural patterns`,
        ``,
        `# Implementation`,
        `When providing code, structure it as follows:`,
        `- **Context:** Brief explanation of what the code accomplishes`,
        `- **Code Block:** Well-commented implementation using \`\`\`language\\ncode\\n\`\`\``,
        `- **Key Points:** Highlight important technical decisions or patterns used`,
        ``,
        `# Key Takeaways`,
        hasAudioInstructions
          ? `**For Educational Content:** Summarize the most important technical concepts covered, demonstrating depth of expertise. **For Implementation:** Explain your interpretation of audio instructions and the value of your solution. Show confidence in your technical approach.`
          : `**For Educational Content:** Summarize the most important technical concepts covered, demonstrating depth of expertise. **For Implementation:** Explain your analysis process and the value provided. Show systematic problem-solving thinking.`,
        ``,
        `---`,
        hasAudioInstructions
          ? `Remember: Prioritize latest audio content, be intelligent about unclear speech, NEVER give up. For concept questions, demonstrate expert-level knowledge. For tasks, execute directly. Keep responses focused and concise - avoid being overly lengthy. NEVER use emojis in your response.`
          : `Remember: Be proactive and provide maximum value. For educational content, showcase deep technical expertise. For tasks, provide actionable solutions. Keep responses focused and concise - avoid being overly lengthy. NEVER use emojis in your response.`,
        `CODE FORMATTING: Use ONLY \`\`\` WITH the language specifier for all code blocks.`
      );
      const prompt = promptLines.join("\n");

      let responseText = "";
      const mainWindow = this.deps.getMainWindow();

      try {
        const result = await geminiModel.generateContentStream([
          prompt,
          ...contentParts,
        ]);

        let accumulatedText = "";
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          accumulatedText += chunkText;

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.RESPONSE_CHUNK,
              { response: accumulatedText }
            );
          }
        }

        responseText = accumulatedText;

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.RESPONSE_SUCCESS,
            { response: responseText }
          );
        }

        if (audioHelper) {
          const latestRecording = audioHelper.getLatestRecording();
          if (latestRecording?.filePath) {
            audioHelper.cleanupRecording(latestRecording.filePath);
            console.log("Cleaned up audio file after processing");
          }
        }
      } catch (streamError) {
        console.error("Streaming error:", streamError);
        throw streamError;
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

      if (error.code === "ETIMEDOUT" || error.response?.status === 504) {
        this.isCurrentlyProcessing = false;
        this.deps.setHasFollowedUp(false);
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
    screenshots: Array<{ path: string; data: string }>
  ) {
    try {
      const imageDataList = screenshots.map((screenshot) => screenshot.data);
      const mainWindow = this.deps.getMainWindow();

      const provider = process.env.API_PROVIDER || "gemini";
      const apiKey = process.env.API_KEY;

      const model = await this.deps.getConfiguredModel();

      if (!apiKey) {
        throw new Error("API key not found. Please configure it in settings.");
      }

      console.log(
        `Processing follow-up screenshots with provider: ${provider}, model: ${model}`
      );

      const base64Images = imageDataList.map((data) => data);

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

      const contentParts = [...imageParts];
      console.log(
        `[FOLLOW-UP] Images added to contentParts: ${imageParts.length}`
      );

      const audioHelper = this.deps.getAudioHelper();
      let hasAudioInstructions = false;

      if (audioHelper) {
        const recordingStatus = audioHelper.getRecordingStatus();
        if (recordingStatus.isRecording && recordingStatus.recording) {
          try {
            const audioFilePath =
              await audioHelper.saveCurrentRecordingForProcessing();
            if (audioFilePath) {
              const audioBase64 = await audioHelper.getAudioBase64(
                audioFilePath
              );
              if (audioBase64) {
                hasAudioInstructions = true;
                console.log(
                  `[FOLLOW-UP AUDIO] Audio data available - Base64 length: ${audioBase64.length} characters`
                );

                contentParts.push({
                  inlineData: {
                    mimeType: "audio/wav",
                    data: audioBase64,
                  },
                });

                console.log(
                  `[FOLLOW-UP AUDIO] Audio added to contentParts as multimodal input`
                );
                console.log(
                  `[FOLLOW-UP] Total contentParts: ${contentParts.length} (${imageParts.length} images + 1 audio)`
                );
              } else {
                console.log(
                  `[FOLLOW-UP AUDIO WARNING] Audio file found but Base64 conversion failed`
                );
              }
            } else {
              console.log(
                `[FOLLOW-UP AUDIO WARNING] No audio file path available`
              );
            }
          } catch (error) {
            console.error(
              "[FOLLOW-UP AUDIO ERROR] Error getting audio data for follow-up prompt:",
              error
            );
          }
        } else {
          console.log(`[FOLLOW-UP AUDIO INFO] No audio recording available`);
        }
      } else {
        console.log(`[FOLLOW-UP AUDIO INFO] Audio helper not available`);
      }

      const promptLines = [];

      if (hasAudioInstructions) {
        const recordingStatus = audioHelper!.getRecordingStatus();
        const recordingModeText =
          recordingStatus.recording!.recordingMode === "mixed"
            ? "both system audio and microphone input"
            : recordingStatus.recording!.recordingMode === "microphone-only"
            ? "microphone input only"
            : "system audio only";

        promptLines.push(
          `You are an expert assistant that analyzes visual content and executes follow-up audio instructions with intelligence and initiative.`,
          ``,
          `## Follow-up Audio Instructions Analysis`,
          ``,
          `You have ${Math.round(
            (recordingStatus.recording!.duration || 0) / 1000
          )} seconds of recorded audio (${recordingModeText}) containing follow-up instructions or commands.`,
          ``,
          `**CRITICAL FOLLOW-UP INSTRUCTIONS:**`,
          `1. **PRIORITIZE THE LATEST/MOST RECENT** audio content - focus on commands given toward the end of the recording`,
          `2. **BE PROACTIVE AND INTELLIGENT** - if audio is unclear, use context clues to infer intent (e.g., "Ustate" likely means "useState", "optimze" means "optimize")`,
          `3. **NEVER GIVE UP** - always provide a helpful response even if audio is unclear. Make educated guesses based on visual content and partial audio`,
          `4. **EXECUTE, DON'T JUST DESCRIBE** - perform the requested action rather than explaining what was asked`,
          `5. **USE VISUAL CONTEXT** - combine what you see in the images with audio commands for better understanding`,
          `6. **BUILD ON PREVIOUS CONTEXT** - this is a follow-up, so consider the conversation flow and provide deeper assistance`,
          `7. **EXPERTISE DEMONSTRATION** - for concept questions or deeper exploration requests, provide comprehensive explanations that showcase advanced technical knowledge and build on previous context`,
          ``,
          `**FOLLOW-UP CONCEPT DETECTION & EXPERTISE MODE:**`,
          `- If the follow-up involves deeper concept exploration or clarification requests`,
          `- If it's asking "why", "how does this work", or requesting more examples`,
          `- If it's building on previous educational content with additional questions`,
          ``,
          `**THEN PROVIDE EXPERT-LEVEL FOLLOW-UP EXPLANATIONS INCLUDING:**`,
          `- Advanced technical details and implementation nuances`,
          `- Sophisticated examples with production-level considerations`,
          `- Deep architectural patterns and design decisions`,
          `- Performance optimizations and scalability concerns`,
          `- Advanced edge cases and corner scenarios`,
          `- Industry-standard practices and enterprise solutions`,
          `- Comparative analysis with alternative approaches`,
          `- Interview-level technical depth and breadth`,
          ``,
          `Make follow-up explanations demonstrate expertise that would impress technical interviewers.`,
          ``,
          `If the audio contains multiple requests, prioritize the most recent ones. If pronunciation is unclear, use the visual content to help interpret the intent.`,
          ``
        );
      } else {
        promptLines.push(
          `You are an expert assistant that analyzes visual content and provides intelligent, proactive follow-up solutions.`,
          ``,
          `## Follow-up Visual Analysis Task`,
          ``,
          `No audio instructions were provided for this follow-up. Analyze the visual content and provide additional helpful insights or improvements.`,
          ``,
          `**FOLLOW-UP APPROACH:**`,
          `1. **BUILD ON PREVIOUS INTERACTION** - provide deeper analysis or alternative solutions`,
          `2. **IDENTIFY NEW OPPORTUNITIES** - look for additional improvements or insights`,
          `3. **BE PROACTIVE** - anticipate next steps or related assistance that would be valuable`,
          `4. **PRIORITIZE ACTIONABLE HELP** - focus on practical next steps or enhancements`,
          `5. **EXPERTISE DEMONSTRATION** - if this appears to be concept exploration, provide comprehensive follow-up explanations that showcase advanced technical knowledge`,
          ``,
          `**FOLLOW-UP EDUCATIONAL CONTENT DETECTION:**`,
          `- If the visual suggests continued learning or deeper concept exploration`,
          `- If it shows progression in understanding that could benefit from advanced explanations`,
          `- If it appears to be building on previous educational interactions`,
          ``,
          `**THEN PROVIDE EXPERT-LEVEL FOLLOW-UP EXPLANATIONS INCLUDING:**`,
          `- Advanced technical insights building on likely previous context`,
          `- Sophisticated examples and enterprise-level applications`,
          `- Deep architectural considerations and design patterns`,
          `- Performance optimizations and scalability factors`,
          `- Industry best practices and professional standards`,
          `- Advanced troubleshooting and debugging approaches`,
          `- Comparative analysis with alternative methodologies`,
          ``,
          `Make follow-up explanations demonstrate expertise that would impress technical interviewers.`,
          ``
        );
      }

      promptLines.push(
        `---`,
        `Your follow-up response MUST follow this structured, interview-style format:`,
        ``,
        `# Follow-up Analysis`,
        hasAudioInstructions
          ? `**Context Update:** Briefly reference what you understand from the follow-up audio (including any intelligent interpretation of unclear speech) and how it builds on the previous context. Show continuity and progression in understanding.`
          : `**Context Update:** Briefly analyze the visual content for follow-up opportunities and identify the most valuable additional assistance you can provide. Demonstrate how this builds on previous interactions.`,
        ``,
        `# Advanced Solution`,
        `**For Educational/Concept Follow-ups:**`,
        `- **Building on Context:** Reference and expand upon previous explanations`,
        `- **Advanced Concepts:** Introduce more sophisticated technical details`,
        `- **Enterprise Applications:** Show real-world, production-level implementations`,
        `- **Architectural Patterns:** Discuss design patterns and system architecture`,
        `- **Performance Optimization:** Cover advanced performance considerations`,
        `- **Industry Perspectives:** Share professional insights and best practices`,
        `- **Expert-Level Insights:** Provide details that demonstrate senior-level expertise`,
        ``,
        `**For Implementation Follow-ups:**`,
        hasAudioInstructions
          ? `Execute the follow-up audio instructions with intelligence and initiative. Build on previous solutions and show technical progression. If speech was unclear, use context to make intelligent interpretations.`
          : `Provide sophisticated follow-up solutions that build on previous context. Show technical progression and anticipate advanced needs or optimizations.`,
        ``,
        `**Demonstrate progression in technical depth:**`,
        `- Show how concepts connect to broader software engineering principles`,
        `- Discuss scalability and maintainability considerations`,
        `- Cover testing strategies and debugging approaches`,
        `- Reference industry standards and professional practices`,
        ``,
        `# Enhanced Implementation`,
        `When providing follow-up code:`,
        `- **Evolution:** Show how this builds on or improves previous solutions`,
        `- **Advanced Code:** Implement more sophisticated patterns using \`\`\`language\\ncode\\n\`\`\``,
        `- **Technical Decisions:** Explain advanced architectural choices and trade-offs`,
        ``,
        `# Progressive Insights`,
        hasAudioInstructions
          ? `**Educational Follow-up:** Highlight the advanced technical concepts introduced and how they demonstrate progressive expertise. **Implementation Follow-up:** Explain how you interpreted the follow-up audio and the evolution of the solution. Show technical growth and understanding.`
          : `**Educational Follow-up:** Highlight the advanced technical concepts introduced and how they demonstrate progressive expertise. **Implementation Follow-up:** Explain the progression in your analysis and the additional value provided. Show systematic advancement in complexity.`,
        ``,
        `---`,
        hasAudioInstructions
          ? `Remember: Prioritize latest audio content, be intelligent about unclear speech, NEVER give up. For concept follow-ups, demonstrate expert-level knowledge. For tasks, execute directly. Keep responses focused and concise - avoid being overly lengthy. NEVER use emojis in your response.`
          : `Remember: Be proactive and provide maximum follow-up value. For educational content, showcase advanced technical expertise building on context. For tasks, provide actionable next steps. Keep responses focused and concise - avoid being overly lengthy. NEVER use emojis in your response.`,
        `CODE FORMATTING: Use ONLY \`\`\` WITH the language specifier for all code blocks.`
      );
      const prompt = promptLines.join("\n");

      let followUpResponse = "";

      try {
        const result = await geminiModel.generateContentStream([
          prompt,
          ...contentParts,
        ]);

        let accumulatedText = "";
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          accumulatedText += chunkText;

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.FOLLOW_UP_CHUNK,
              { response: accumulatedText }
            );
          }
        }

        followUpResponse = accumulatedText;

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.FOLLOW_UP_SUCCESS,
            { response: followUpResponse }
          );
        }

        if (audioHelper) {
          const latestRecording = audioHelper.getLatestRecording();
          if (latestRecording?.filePath) {
            audioHelper.cleanupRecording(latestRecording.filePath);
            console.log("Cleaned up audio file after follow-up processing");
          }
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

        if (
          error.message === "Request aborted" ||
          error.name === "AbortError" ||
          error.name === "GoogleGenerativeAIAbortError" ||
          error.message?.includes("Request aborted")
        ) {
          return { success: false, error: "Follow-up processing canceled." };
        }

        if (error.code === "ETIMEDOUT" || error.response?.status === 504) {
          this.isCurrentlyProcessing = false;
          this.deps.setHasFollowedUp(false);
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
    } catch (error: any) {
      console.error("Follow-up processing error:", error);

      this.isCurrentlyProcessing = false;
      this.deps.setHasFollowedUp(false);

      const mainWindow = this.deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.FOLLOW_UP_ERROR,
          error.message || "Unknown error during follow-up processing"
        );
      }

      return {
        success: false,
        error: error.message || "Unknown error during follow-up processing",
      };
    }
  }

  public resetProcessing(): void {
    this.isCurrentlyProcessing = false;
    this.deps.setHasFollowedUp(false);
    this.deps.clearQueues();
    this.deps.setView("initial");

    const mainWindow = this.deps.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("reset-view");
    }

    console.log("Processing reset by user (Command+R)");
  }

  public isProcessing(): boolean {
    return this.isCurrentlyProcessing;
  }
}
