import { cn } from "@/lib/utils"

type Size = "xs" | "sm" | "md" | "lg"
type Variant = "full" | "mark" | "stacked"

const markDims: Record<Size, { w: number; h: number }> = {
  xs: { w: 20, h: 12 },
  sm: { w: 28, h: 17 },
  md: { w: 60, h: 36 },
  lg: { w: 96, h: 58 },
}
const strokeWeight: Record<Size, number> = { xs: 4.5, sm: 3.5, md: 2.2, lg: 2.0 }
const dotRadius: Record<Size, number> = { xs: 11, sm: 10, md: 7.5, lg: 7 }

interface MarkProps { size?: Size; className?: string }

export function VIGILMark({ size = "md", className }: MarkProps) {
  const { w, h } = markDims[size]
  const sw = strokeWeight[size]
  const dr = dotRadius[size]

  if (size === "xs" || size === "sm") {
    return (
      <svg width={w} height={h} viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("text-foreground shrink-0", className)} aria-hidden="true">
        <path d="M 4,80 L 45,6 L 86,80" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="miter"/>
        <circle cx="45" cy="6" r={dr} fill="#2A5D9C"/>
      </svg>
    )
  }

  return (
    <svg width={w} height={h} viewBox="0 0 180 108" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("text-foreground shrink-0", className)} aria-hidden="true">
      <line x1="0" y1="81" x2="58" y2="81" stroke="currentColor" strokeWidth={sw} strokeLinecap="round"/>
      <path d="M 58,81 L 90,14 L 122,81" stroke="currentColor" strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="miter"/>
      <line x1="122" y1="81" x2="180" y2="81" stroke="currentColor" strokeWidth={sw} strokeLinecap="round"/>
      <circle cx="90" cy="14" r={dr} fill="#2A5D9C"/>
      {(size === "md" || size === "lg") && <circle cx="90" cy="14" r="2.8" fill="#7AA0C8"/>}
    </svg>
  )
}

const wordmarkClass: Record<Size, string> = {
  xs: "text-[11px] tracking-[0.05em]",
  sm: "text-[14px] tracking-[0.05em]",
  md: "text-[26px] tracking-[0.04em]",
  lg: "text-[42px] tracking-[0.04em]",
}
const markGap: Record<Size, string> = { xs: "gap-[7px]", sm: "gap-[9px]", md: "gap-[14px]", lg: "gap-[18px]" }

interface LogoProps { size?: Size; variant?: Variant; className?: string }

export function Logo({ size = "sm", variant = "full", className }: LogoProps) {
  if (variant === "mark") return <VIGILMark size={size} className={className}/>

  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <VIGILMark size={size}/>
        <span className={cn("font-display font-black uppercase text-foreground leading-none", wordmarkClass[size])}>VIGIL</span>
        <span className="font-mono text-[7px] tracking-[0.35em] uppercase text-muted-foreground">Prop Intelligence</span>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center", markGap[size], className)}>
      <VIGILMark size={size}/>
      <span className={cn("font-display font-black uppercase text-foreground leading-none", wordmarkClass[size])}>VIGIL</span>
    </div>
  )
}
