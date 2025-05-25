import { BackslashIcon, EnterIcon } from "./icons";

import { COMMAND_KEY } from "../utils/platform";
import { Settings } from "lucide-react";
import Tooltip from "./shared/Tooltip";

interface CommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void;
  view: "initial" | "response" | "followup";
  isLoading?: boolean;
}

export default function Commands({
  onTooltipVisibilityChange,
  view,
  isLoading = false,
}: CommandsProps) {
  const isInitialView = view === "initial";
  const showAskFollowUp = !isInitialView && !isLoading;

  return (
    <div className="select-none">
      <div className="pt-2 w-fit">
        <div className="text-xs text-foreground backdrop-blur-md bg-background/80 rounded-lg py-2 px-4 flex items-center justify-start gap-3 pointer-events-none">
          <div className="flex items-center gap-2 rounded px-2 py-1.5 pointer-events-none select-none">
            <span className="text-xs leading-none truncate">Show/Hide</span>
            <div className="flex gap-1">
              <button className="bg-muted rounded-md px-1.5 py-1 text-xs leading-none">
                {COMMAND_KEY}
              </button>
              <button className="bg-muted rounded-md px-1.5 py-1 text-xs leading-none">
                {BackslashIcon}
              </button>
            </div>
          </div>

          {(isInitialView || showAskFollowUp) && (
            <div className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors pointer-events-none select-none">
              <span className="text-xs leading-none truncate">
                {isInitialView ? "Ask AI" : "Ask Follow Up"}
              </span>
              <div className="flex gap-1">
                <button className="bg-muted rounded-md px-1.5 py-1 text-xs leading-none">
                  {COMMAND_KEY}
                </button>
                <button className="bg-muted rounded-md px-1.5 py-1 text-xs leading-none">
                  {EnterIcon}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors pointer-events-none select-none">
            <span className="text-xs leading-none truncate">Reset</span>
            <div className="flex gap-1 flex-shrink-0">
              <span className="bg-muted px-1.5 py-0.5 rounded text-xs leading-none">
                {COMMAND_KEY}
              </span>
              <span className="bg-muted px-1.5 py-0.5 rounded text-xs leading-none">
                R
              </span>
            </div>
          </div>

          <div className="mx-2 h-4 w-px bg-border" />

          <Tooltip
            onVisibilityChange={onTooltipVisibilityChange}
            trigger={<Settings className="h-4 w-4" />}
          />
        </div>
      </div>
    </div>
  );
}
