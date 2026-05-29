"use client";
import { useState } from "react";
import { X, Lock, Unlock } from "lucide-react";
import { BOOKS, REFERENCE_BOOK_IDS } from "@/lib/books";
import { WEIGHT_PRESETS, exchangeOnlyWeights } from "@/lib/book-weights";
import type { WeightMap } from "@/lib/devig";

interface Props {
  open: boolean;
  onClose: () => void;
  weights: WeightMap;
  setWeights: (w: WeightMap) => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  sharp: "Sharp Books",
  exchange: "Exchange Books",
  retail: "Retail Books",
};
const CATEGORY_ORDER = ["sharp", "exchange", "retail"];

export function FairValueSettings({ open, onClose, weights, setWeights }: Props) {
  const [draft, setDraft] = useState<WeightMap>(() => ({ ...weights }));

  if (!open) return null;

  const booksByCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    books: REFERENCE_BOOK_IDS.filter((id) => BOOKS[id]?.category === cat),
  })).filter((g) => g.books.length > 0);

  const applyPreset = (factory: () => WeightMap) => {
    const base = factory();
    // preserve locked weights
    const next: WeightMap = { ...base };
    for (const id of REFERENCE_BOOK_IDS) {
      if (draft[id]?.locked) next[id] = { ...draft[id] };
    }
    setDraft(next);
  };

  const toggle = (id: string) => {
    setDraft((d) => ({ ...d, [id]: { ...d[id], enabled: !d[id]?.enabled } }));
  };

  const setWeight = (id: string, val: number) => {
    setDraft((d) => ({ ...d, [id]: { ...d[id], weight: Math.max(0, val) } }));
  };

  const toggleLock = (id: string) => {
    setDraft((d) => ({ ...d, [id]: { ...d[id], locked: !d[id]?.locked } }));
  };

  const handleApply = () => {
    setWeights(draft);
    onClose();
  };

  const handleCancel = () => {
    setDraft({ ...weights });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={handleCancel} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Fair Value Settings</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Configure which books contribute to the fair odds consensus.</p>
          </div>
          <button onClick={handleCancel} className="text-muted-foreground hover:text-foreground transition-colors ml-4 mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Presets */}
        <div className="px-5 py-3 border-b border-border/60 shrink-0">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2">Presets</p>
          <div className="flex flex-wrap gap-2">
            {WEIGHT_PRESETS.map((p) => (
              <button key={p.id} onClick={() => applyPreset(p.factory)}
                className="px-3 py-1 rounded-full text-xs border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Book list */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">
          {booksByCategory.map(({ cat, books }) => (
            <div key={cat}>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2">{CATEGORY_LABEL[cat]}</p>
              <div className="space-y-1">
                {books.map((id) => {
                  const book = BOOKS[id];
                  const w = draft[id] ?? { enabled: false, weight: 1 };
                  return (
                    <div key={id} className={["flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors",
                      w.enabled ? "border-border bg-card" : "border-border/40 bg-transparent opacity-50"].join(" ")}>
                      {/* Checkbox */}
                      <button onClick={() => toggle(id)}
                        className={["w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                          w.enabled ? "bg-blue-500 border-blue-500" : "border-border bg-transparent"].join(" ")}>
                        {w.enabled && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>}
                      </button>

                      {/* Label */}
                      <span className="text-sm flex-1 text-foreground">{book?.label ?? id}</span>

                      {/* Weight */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Wt:</span>
                        <input
                          type="number" min={0} max={10} step={1}
                          value={w.weight}
                          onChange={(e) => setWeight(id, parseFloat(e.target.value) || 0)}
                          disabled={!w.enabled}
                          className="w-12 h-7 rounded border border-border bg-background text-center text-sm font-mono disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                        />
                      </div>

                      {/* Lock */}
                      <button onClick={() => toggleLock(id)}
                        className={["transition-colors", w.locked ? "text-blue-400" : "text-muted-foreground/30 hover:text-muted-foreground"].join(" ")}>
                        {w.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <button onClick={handleCancel}
            className="px-4 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground border border-border hover:border-border/80 transition-colors">
            Cancel
          </button>
          <button onClick={handleApply}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
