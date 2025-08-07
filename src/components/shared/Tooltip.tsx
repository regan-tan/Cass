import { AnimatePresence, motion } from "framer-motion";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import React, { useEffect, useRef, useState } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";

export interface TooltipProps {
  onVisibilityChange: (visible: boolean, height: number) => void;
  trigger: React.ReactNode;
}

const MODEL_OPTIONS = [
  // OpenAI Models
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Most capable multimodal model (OpenAI)",
    provider: "openai",
    default: true,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    description: "Fast and cost-effective multimodal model (OpenAI)",
    provider: "openai",
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    description: "Advanced reasoning with vision capabilities (OpenAI)",
    provider: "openai",
  },
  // OpenRouter Models
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    description: "Most capable Claude model with vision (Anthropic)",
    provider: "openrouter",
  },
  {
    id: "anthropic/claude-3-haiku",
    name: "Claude 3 Haiku",
    description: "Fast and efficient Claude model (Anthropic)",
    provider: "openrouter",
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Fast Gemini model via OpenRouter (Google)",
    provider: "openrouter",
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    description: "OpenAI's flagship model via OpenRouter",
    provider: "openrouter",
  },
  {
    id: "meta-llama/llama-3.2-90b-vision-instruct",
    name: "Llama 3.2 90B Vision",
    description: "Meta's powerful vision model (Meta)",
    provider: "openrouter",
  },
  {
    id: "qwen/qwen-2-vl-72b-instruct",
    name: "Qwen2-VL 72B",
    description: "Advanced multimodal model (Alibaba)",
    provider: "openrouter",
  },
  // Gemini Models (Direct)
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Fast and efficient Gemini model (Google)",
    provider: "gemini",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description: "Advanced reasoning and capabilities (Google)",
    provider: "gemini",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    description: "Efficient Gemini model (Google)",
    provider: "gemini",
  },
];

export default function Tooltip({ trigger, onVisibilityChange }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState(
    () => MODEL_OPTIONS.find((m) => m.default)?.id || "gpt-4o"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const loadCurrentConfig = async () => {
      try {
        const response = await (window.electronAPI as any).getApiConfig();
        if (response.success) {
          if (response.apiKey) setApiKey(response.apiKey);
          if (response.openaiApiKey) setOpenaiApiKey(response.openaiApiKey);
          if (response.model) setSelectedModel(response.model);
          // Provider is automatically determined from the model selection
        }
      } catch {
        setError("Failed to load configuration");
      }
    };
    loadCurrentConfig();

    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      window.electronAPI.setIgnoreMouseEvents();
    };
  }, []);

  useEffect(() => {
    let height = 0;
    if (tooltipRef.current && isVisible)
      height = tooltipRef.current.offsetHeight + 10;
    onVisibilityChange(isVisible, height);
  }, [isVisible, onVisibilityChange]);

  function handleTriggerMouseEnter() {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (!isVisible) {
      setIsVisible(true);
      window.electronAPI.setInteractiveMouseEvents();
    }
  }

  function handleTriggerMouseLeave() {
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      window.electronAPI.setIgnoreMouseEvents();
    }, 100);
  }

  function handleTooltipContentMouseEnter() {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  }

  function handleTooltipContentMouseLeave() {
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      window.electronAPI.setIgnoreMouseEvents();
    }, 100);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!apiKey.trim()) {
      setError("API key cannot be empty");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Determine provider from selected model
      const selectedModelOption = MODEL_OPTIONS.find(m => m.id === selectedModel);
      const provider = selectedModelOption?.provider || "openai";
      
      const result = await (window.electronAPI as any).setApiConfig({
        apiKey: apiKey.trim(),
        model: selectedModel,
        provider: provider,
        openaiApiKey: openaiApiKey.trim(),
      });
      if (result.success) {
        setIsVisible(false);
        window.electronAPI.setIgnoreMouseEvents();
      } else {
        setError(result.error || "Failed to save configuration");
      }
    } catch {
      setError("An error occurred while saving the configuration");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="relative inline-block pointer-events-auto z-[9998]"
      onMouseEnter={handleTriggerMouseEnter}
      onMouseLeave={handleTriggerMouseLeave}
    >
      <div 
        className="w-6 h-6 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("Settings button clicked, current visibility:", isVisible);
          setIsVisible(!isVisible);
        }}
      >
        {trigger}
      </div>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={tooltipRef}
            className="absolute top-full -right-2 mt-8 w-[310px] z-[9999] pointer-events-auto"
            onMouseEnter={handleTooltipContentMouseEnter}
            onMouseLeave={handleTooltipContentMouseLeave}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <div className="mt-2 p-3 text-xs bg-background/80 backdrop-blur-md rounded-lg text-foreground shadow-lg">
              <div className="space-y-4">
                <h3 className="font-medium truncate px-2 mb-3 select-none">
                  API Configuration
                </h3>
                <p className="text-xs text-muted-foreground mb-4 px-2">
                  Your API key is stored locally. Select your preferred model. Custom prompts can be set from the main taskbar.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4 px-2">
                  <div>
                    <label
                      htmlFor="apiKey"
                      className="block text-xs font-medium text-foreground mb-3"
                    >
                      API Key
                    </label>
                    <Input
                      ref={inputRef}
                      type="password"
                      id="apiKey"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter API key (e.g., sk-... or AIza...)"
                      autoComplete="off"
                      spellCheck="false"
                      className="text-xs h-8 select-text"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="openaiApiKey"
                      className="block text-xs font-medium text-foreground mb-3"
                    >
                      OpenAI API Key (for audio transcription)
                    </label>
                    <Input
                      type="password"
                      id="openaiApiKey"
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      placeholder="Enter OpenAI API key for audio transcription"
                      autoComplete="off"
                      spellCheck="false"
                      className="text-xs h-8 select-text"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Required for audio transcription when using OpenRouter or Gemini models
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="model"
                      className="block text-xs font-medium text-foreground mb-3"
                    >
                      AI Model
                    </label>
                    <RadioGroup
                      value={selectedModel}
                      onValueChange={setSelectedModel}
                    >
                      <ScrollArea className="max-h-48 pr-1">
                        <div className="space-y-3">
                          {/* OpenAI Models */}
                          <div>
                            <div className="text-[10px] font-semibold text-blue-400 mb-1.5 uppercase tracking-wide">
                              OpenAI Direct
                            </div>
                            <div className="space-y-2">
                              {MODEL_OPTIONS.filter(model => model.provider === "openai").map((model) => (
                                <div
                                  key={model.id}
                                  className="flex items-start space-x-2.5"
                                >
                                  <RadioGroupItem
                                    value={model.id}
                                    id={`model-${model.id}`}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1">
                                    <label
                                      htmlFor={`model-${model.id}`}
                                      className="text-xs font-medium text-foreground leading-tight cursor-pointer"
                                    >
                                      {model.name}
                                      {model.default && (
                                        <span className="ml-1.5 text-[10px] bg-primary/60 px-1.5 py-0.5 rounded-full align-middle">
                                          Rec.
                                        </span>
                                      )}
                                    </label>
                                    <p className="text-[11px] text-muted-foreground leading-snug">
                                      {model.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* OpenRouter Models */}
                          <div>
                            <div className="text-[10px] font-semibold text-purple-400 mb-1.5 uppercase tracking-wide">
                              OpenRouter (Multi-Provider)
                            </div>
                            <div className="space-y-2">
                              {MODEL_OPTIONS.filter(model => model.provider === "openrouter").map((model) => (
                                <div
                                  key={model.id}
                                  className="flex items-start space-x-2.5"
                                >
                                  <RadioGroupItem
                                    value={model.id}
                                    id={`model-${model.id}`}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1">
                                    <label
                                      htmlFor={`model-${model.id}`}
                                      className="text-xs font-medium text-foreground leading-tight cursor-pointer"
                                    >
                                      {model.name}
                                      {model.default && (
                                        <span className="ml-1.5 text-[10px] bg-primary/60 px-1.5 py-0.5 rounded-full align-middle">
                                          Rec.
                                        </span>
                                      )}
                                    </label>
                                    <p className="text-[11px] text-muted-foreground leading-snug">
                                      {model.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Gemini Models */}
                          <div>
                            <div className="text-[10px] font-semibold text-green-400 mb-1.5 uppercase tracking-wide">
                              Google Gemini Direct
                            </div>
                            <div className="space-y-2">
                              {MODEL_OPTIONS.filter(model => model.provider === "gemini").map((model) => (
                                <div
                                  key={model.id}
                                  className="flex items-start space-x-2.5"
                                >
                                  <RadioGroupItem
                                    value={model.id}
                                    id={`model-${model.id}`}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1">
                                    <label
                                      htmlFor={`model-${model.id}`}
                                      className="text-xs font-medium text-foreground leading-tight cursor-pointer"
                                    >
                                      {model.name}
                                      {model.default && (
                                        <span className="ml-1.5 text-[10px] bg-primary/60 px-1.5 py-0.5 rounded-full align-middle">
                                          Rec.
                                        </span>
                                      )}
                                    </label>
                                    <p className="text-[11px] text-muted-foreground leading-snug">
                                      {model.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </ScrollArea>
                    </RadioGroup>
                  </div>
                  {error && (
                    <div className="text-destructive-foreground text-[11px] py-1.5 px-2 rounded bg-destructive/30 border border-destructive/50">
                      {error}
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      size="sm"
                      className="text-xs h-7"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Config"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="text-xs h-7"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                          await (window.electronAPI as any).quitApplication();
                        } catch (error) {}
                      }}
                    >
                      Quit App
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
