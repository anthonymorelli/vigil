
// src/components/filters-popover.tsx
// Replaces the inline MIN SLIP EV filter bar.
// Single "Filters" trigger with a popover containing:
//   - Min % Hit slider (50–62%)
//   - Show Alt Lines toggle
// Badge on the trigger shows the count of non-default active filters.

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type FiltersPopoverProps = {
  minHitPct: number;
  onMinHitPctChange: (v: number) => void;
  showAltLines: boolean;
  onShowAltLinesChange: (v: boolean) => void;
};

const MIN_HIT_DEFAULT = 52;

export function FiltersPopover({
  minHitPct,
  onMinHitPctChange,
  showAltLines,
  onShowAltLinesChange,
}: FiltersPopoverProps) {
  const [open, setOpen] = useState(false);

  // Count non-default active filters
  const activeCount =
    (minHitPct !== MIN_HIT_DEFAULT ? 1 : 0) + (showAltLines ? 1 : 0);

  const handleReset = () => {
    onMinHitPctChange(MIN_HIT_DEFAULT);
    onShowAltLinesChange(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-8 relative"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white leading-none">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-4 space-y-5" align="start">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Filters</p>
          {activeCount > 0 && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Reset
            </button>
          )}
        </div>

        {/* Min % Hit */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Min % Hit
            </label>
            <span className="font-mono text-sm font-semibold tabular-nums">
              {minHitPct.toFixed(1)}%
            </span>
          </div>

          {/* Native range — styled for dark theme */}
          <input
            type="range"
            min={50}
            max={62}
            step={0.5}
            value={minHitPct}
            onChange={(e) => onMinHitPctChange(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer
              bg-border
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-blue-500
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-background
              [&::-webkit-slider-thumb]:shadow-sm
              [&::-moz-range-thumb]:h-4
              [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-blue-500
              [&::-moz-range-thumb]:border-2
              [&::-moz-range-thumb]:border-background"
          />

          {/* Tick labels */}
          <div className="flex justify-between text-[10px] text-muted-foreground/60 font-mono">
            <span>50%</span>
            <span>54%</span>
            <span>58%</span>
            <span>62%</span>
          </div>
        </div>

        {/* Alt Lines toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-border/60">
          <div>
            <p className="text-xs font-medium">Alt Lines</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Show Discount / Boost lines
            </p>
          </div>
          <button
            onClick={() => onShowAltLinesChange(!showAltLines)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              showAltLines ? "bg-blue-500" : "bg-border"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                showAltLines ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}