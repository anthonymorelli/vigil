import { cn } from "@/lib/utils";

interface LogoProps {
  /** Extra classes on the outer wrapper */
  className?: string;
  /**
   * Mark height in px — wordmark font-size matches.
   * Desktop sidebar: 22 (default)
   * Mobile top bar:  18
   */
  size?: number;
  variant?: "dark" | "light";
}

/**
 * Vigil primary logo
 *
 * Mark  — Pulse (QRS waveform)
 *          viewBox="0 0 88 34"
 *          path: M 0,23 L 20,23 L 23,26.5 L 29,5
 *                L 35,23 L 39.5,18 L 44,23 L 88,23
 *          apex dot: cx=29 cy=5 r=2.8 fill="#2A5D9C"
 *
 * Wordmark — Elan ITC Black, tracked 6px
 */
export function Logo({ className, size, variant = "dark" }: LogoProps) {
  const s      = typeof size === "number" && !isNaN(size) && size > 0 ? size : 22;
  const markW  = Math.round((s * 88) / 34);
  const stroke = variant === "light" ? "#0a0a0a" : "#ffffff";
  const ink    = variant === "light" ? "#0a0a0a" : "#ffffff";

  return (
    <div
      className={cn("flex items-center select-none shrink-0", className)}
      style={{ gap: 16 }}
    >
      {/* ── Pulse mark ── */}
      <svg
        viewBox="0 0 88 34"
        width={markW}
        height={s}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: "visible", flexShrink: 0 }}
        aria-hidden="true"
      >
        <path
          d="M 0,23 L 20,23 L 23,26.5 L 29,5 L 35,23 L 39.5,18 L 44,23 L 88,23"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        <circle cx="29" cy="5" r="2.8" fill="#2A5D9C" />
      </svg>

      {/* ── Wordmark — Elan ITC Black ── */}
      <span
        style={{
          // Tries the CSS variable first (if configured via next/font),
          // then falls back to the direct font-family name.
          fontFamily:
            "var(--font-brand, 'Elan ITC W04 Black', 'Elan ITC Black', sans-serif)",
          fontSize: s,
          fontWeight: 900,
          color: ink,
          letterSpacing: "6px",
          paddingLeft: "6px",
          lineHeight: 1,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        VIGIL
      </span>
    </div>
  );
}