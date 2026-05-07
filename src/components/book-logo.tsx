// src/components/book-logo.tsx
// Hotlinks logos from Brandfetch CDN — the legitimate, professional approach
// Logos always stay current. Client ID goes in NEXT_PUBLIC_BRANDFETCH_CLIENT_ID
// in .env.local (Next.js exposes NEXT_PUBLIC_ vars to the browser, which is fine
// since the Client ID is meant to be public per Brandfetch's docs)

"use client";

import { useState } from "react";

// ============================================================================
// Book → domain mapping (used to construct Brandfetch CDN URLs)
// PP Discount and PP Boost share the prizepicks.com domain
// ============================================================================

const BOOK_DOMAIN: Record<string, string> = {
  "DraftKings": "draftkings.com",
  "BetMGM": "betmgm.com",
  "Caesars": "caesars.com",
  "Fanatics": "fanaticsbetting.com",
  "BetRivers": "betrivers.com",
  "bet365": "bet365.com",
  "BetOnline": "betonline.ag",
  "Bovada": "bovada.lv",
  "Hard Rock": "hardrock.bet",
  "Fliff": "fliff.com",
  "PrizePicks": "prizepicks.com",
  "PP Demons": "prizepicks.com",
  "PP Goblins": "prizepicks.com",
  "Novig": "novig.us",
  "ProphetX": "prophetx.co",
  "Kalshi": "kalshi.com",
  "Polymarket": "polymarket.com",
  "Underdog": "underdogfantasy.com",
  "Betr": "betr.app",
};

// Display name remap (for accessibility labels and fallback badges)
function displayName(book: string): string {
  if (book === "PP Goblins") return "PP Discount";
  if (book === "PP Demons") return "PP Boost";
  return book;
}

// Variant suffix for alt-line books — shown next to PrizePicks logo
function altLineSuffix(book: string): string {
  if (book === "PP Goblins") return "Discount";
  if (book === "PP Demons") return "Boost";
  return "";
}

// ============================================================================
// Brand-colored fallback styles (used when CDN fails or domain unmapped)
// ============================================================================

type BadgeStyle = {
  label: string;
  bg: string;
  text: string;
  border?: string;
};

const FALLBACK_STYLES: Record<string, BadgeStyle> = {
  "PrizePicks":  { label: "PrizePicks",  bg: "#7B2FBE", text: "#ffffff" },
  "PP Demons":   { label: "PP Boost",    bg: "#9D3FE8", text: "#ffffff" },
  "PP Goblins":  { label: "PP Discount", bg: "#5C1F9A", text: "#ffffff" },
  "DraftKings":  { label: "DraftKings",  bg: "#1A9C3E", text: "#ffffff" },
  "BetMGM":      { label: "BetMGM",      bg: "#C9A84C", text: "#000000" },
  "Caesars":     { label: "Caesars",     bg: "#003087", text: "#ffffff" },
  "Fanatics":    { label: "Fanatics",    bg: "#E31837", text: "#ffffff" },
  "BetRivers":   { label: "BetRivers",   bg: "#1255CC", text: "#ffffff" },
  "bet365":      { label: "bet365",      bg: "#027B5B", text: "#ffffff" },
  "BetOnline":   { label: "BetOnline",   bg: "#1B2A4A", text: "#ffffff", border: "#2E4070" },
  "Bovada":      { label: "Bovada",      bg: "#E8820C", text: "#ffffff" },
  "Hard Rock":   { label: "Hard Rock",   bg: "#C41E3A", text: "#ffffff" },
  "Fliff":       { label: "Fliff",       bg: "#38BDF8", text: "#000000" },
  "Novig":       { label: "Novig",       bg: "#111111", text: "#ffffff", border: "#333333" },
  "ProphetX":    { label: "ProphetX",    bg: "#FF6B00", text: "#ffffff" },
  "Kalshi":      { label: "Kalshi",      bg: "#00B4D8", text: "#000000" },
  "Polymarket":  { label: "Polymarket",  bg: "#0072F5", text: "#ffffff" },
  "Underdog":    { label: "Underdog",    bg: "#E85D2B", text: "#ffffff" },
  "Pick6":       { label: "Pick6",       bg: "#00D4AA", text: "#000000" },
  "Betr":        { label: "Betr",        bg: "#7C3AED", text: "#ffffff" },
};

const DEFAULT_FALLBACK: BadgeStyle = {
  label: "",
  bg: "#27272a",
  text: "#a1a1aa",
  border: "#3f3f46",
};

// ============================================================================
// Component
// ============================================================================

const CLIENT_ID = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID;

type BookLogoProps = {
  book: string;
  size?: "sm" | "md" | "header";
};

export function BookLogo({ book, size = "sm" }: BookLogoProps) {
  const [imageError, setImageError] = useState(false);

  const domain = BOOK_DOMAIN[book];
  const showLogo = domain && CLIENT_ID && !imageError;
  const suffix = altLineSuffix(book);

  // ---- Header tile — ~32px icon, no extra wrapper ----
  if (size === "header") {
    const style = FALLBACK_STYLES[book] ?? { ...DEFAULT_FALLBACK, label: book };
    if (showLogo) {
      const logoUrl = `https://cdn.brandfetch.io/${domain}/icon?c=${CLIENT_ID}`;
      return (
        <img
          src={logoUrl}
          alt={displayName(book)}
          title={displayName(book)}
          className="w-9 h-9 rounded-lg object-contain"
          onError={() => setImageError(true)}
          referrerPolicy="no-referrer-when-downgrade"
        />
      );
    }
    // Fallback — colored square with initials
    return (
      <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[11px] font-bold"
        style={{ backgroundColor: style.bg, color: style.text }}
        title={displayName(book)}
      >
        {(style.label || book).slice(0, 2).toUpperCase()}
      </span>
    );
  }

  // ---- Brandfetch CDN render path (sm / md) ----
  if (showLogo) {
    const logoHeight = size === "md" ? "h-5" : "h-4";
    const suffixSize = size === "md" ? "text-xs" : "text-[10px]";
    const logoUrl = `https://cdn.brandfetch.io/${domain}?c=${CLIENT_ID}&theme=dark`;

    return (
      <span className="inline-flex items-center gap-1.5">
        <img
          src={logoUrl}
          alt={displayName(book)}
          title={displayName(book)}
          className={`${logoHeight} w-auto`}
          onError={() => setImageError(true)}
          referrerPolicy="no-referrer-when-downgrade"
        />
        {suffix && (
          <span className={`${suffixSize} text-muted-foreground font-medium uppercase tracking-wide`}>
            {suffix}
          </span>
        )}
      </span>
    );
  }

  // ---- Fallback colored pill (sm / md) ----
  const style = FALLBACK_STYLES[book] ?? { ...DEFAULT_FALLBACK, label: book };
  const paddingClass = size === "md" ? "px-2.5 py-1" : "px-2 py-0.5";
  const textClass = size === "md" ? "text-xs" : "text-[11px]";

  return (
    <span
      className={`inline-flex items-center rounded-md font-medium whitespace-nowrap ${paddingClass} ${textClass}`}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: style.border ? `1px solid ${style.border}` : "none",
      }}
    >
      {style.label || book}
    </span>
  );
}