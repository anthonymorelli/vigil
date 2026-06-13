import { cn } from "@/lib/utils";

interface LogoProps {
  /** Extra classes on the outer wrapper */
  className?: string;
  /**
   * Wordmark font-size in px.
   * Desktop sidebar: 22 (default)
   * Mobile top bar:  18
   */
  size?: number;
  /**
   * Mark height multiplier relative to `size`.
   * The three-crosses mark needs to render larger than wordmark cap-height
   * to keep its detail at small sizes. 1.7 ≈ mark sits a bit above/below the
   * cap line, which reads as a normal lockup. Tune 1.5–2.0 to taste.
   */
  markScale?: number;
  variant?: "dark" | "light";
}

/**
 * Vigil primary logo
 *
 * Mark — Three Crosses (NOCTA-construction cross glyph, V formation)
 *         Locked: outer tilt 28°, arm reach 100%, center cross signal blue.
 *         viewBox is cropped tight to the artwork so height isn't wasted on padding.
 *         Center cross stays #2A5D9C in both variants (brand color, not foreground).
 *
 * Wordmark — Elan ITC Black, tracked 6px
 */

const CENTER_PATH =
  "M 0,-68 C 1.5,-48.96 9.24,-15 42,-12 C 9.24,-9 2,35 0,175 C -2,35 -9.24,-9 -42,-12 C -9.24,-15 -1.5,-48.96 0,-68 Z";
const OUTER_PATH =
  "M 0,-57 C 1.5,-41.04 7.7,-13 35,-10 C 7.7,-7 2,29.6 0,148 C -2,29.6 -7.7,-7 -35,-10 C -7.7,-13 -1.5,-41.04 0,-57 Z";

// Locked formation transforms (tilt 28°)
const TILT = 28;
const SPREAD = 110;
const DROP = 56;

// Tight bounding box of the assembled artwork (computed, +6 pad)
const VB = { x: -151.6, y: -74.0, w: 303.2, h: 266.7 };
const MARK_ASPECT = VB.w / VB.h; // ~1.137

export function Logo({
  className,
  size,
  markScale = 1.7,
  variant = "dark",
}: LogoProps) {
  const s = typeof size === "number" && !isNaN(size) && size > 0 ? size : 22;

  const markH = Math.round(s * markScale);
  const markW = Math.round(markH * MARK_ASPECT);

  const ink = variant === "light" ? "#0a0a0a" : "#ffffff";
  const outerFill = variant === "light" ? "#0a0a0a" : "#f0efec";

  return (
    <div
      className={cn("flex items-center select-none shrink-0", className)}
      style={{ gap: 14 }}
    >
      {/* ── Three-crosses mark ── */}
      <svg
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        width={markW}
        height={markH}
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: "visible", flexShrink: 0 }}
        aria-hidden="true"
      >
        <g transform={`translate(${-SPREAD},${DROP}) rotate(${-TILT})`}>
          <path d={OUTER_PATH} fill={outerFill} />
        </g>
        <path d={CENTER_PATH} fill="#2A5D9C" />
        <g transform={`translate(${SPREAD},${DROP}) rotate(${TILT})`}>
          <path d={OUTER_PATH} fill={outerFill} />
        </g>
      </svg>

      {/* ── Wordmark — Elan ITC Black ── */}
      <span
        style={{
          fontFamily: "var(--font-geist-sans, system-ui, sans-serif)",
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