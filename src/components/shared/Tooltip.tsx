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
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    description: "Fast and efficient Gemini model (Google)",
  },
  {
    id: "gemini-2.5-pro-preview-03-25",
    name: "Gemini 2.5 Pro Preview",
    description: "Latest preview version of Gemini 2.5 Pro (Google)",
    default: true,
  },
  {
    id: "gemini-2.5-flash-preview-04-17",
    name: "Gemini 2.5 Flash Preview 04-17",
    description: "Latest preview version of Gemini 2.5 Flash (Google)",
  },
];

export default function Tooltip({ trigger, onVisibilityChange }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState(
    () =>
      MODEL_OPTIONS.find((m) => m.default)?.id || "gemini-2.5-pro-preview-03-25"
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
          if (response.model) setSelectedModel(response.model);
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
    setIsVisible(true);
    window.electronAPI.setInteractiveMouseEvents();
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
      const result = await (window.electronAPI as any).setApiConfig({
        apiKey: apiKey.trim(),
        model: selectedModel,
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
      className="relative inline-block pointer-events-auto"
      onMouseEnter={handleTriggerMouseEnter}
      onMouseLeave={handleTriggerMouseLeave}
    >
      <div className="w-4 h-4 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
        {trigger}
      </div>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={tooltipRef}
            className="absolute top-full -right-4 mt-4 w-[310px] z-[100] pointer-events-auto"
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
                  Your API key is stored locally. Select your preferred model.
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
                      htmlFor="model"
                      className="block text-xs font-medium text-foreground mb-3"
                    >
                      AI Model
                    </label>
                    <RadioGroup
                      value={selectedModel}
                      onValueChange={setSelectedModel}
                    >
                      <ScrollArea className="max-h-32 pr-1">
                        <div className="space-y-2">
                          {MODEL_OPTIONS.map((model) => (
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
                                  className="text-xs font-medium text-foreground leading-tight"
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
                      </ScrollArea>
                    </RadioGroup>
                  </div>
                  {error && (
                    <div className="text-destructive-foreground text-[11px] py-1.5 px-2 rounded bg-destructive/30 border border-destructive/50">
                      {error}
                    </div>
                  )}
                  <div className="flex justify-end pt-1">
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
