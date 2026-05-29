"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/Logo"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { href: "/",        label: "Scanner" },
  { href: "/slips",   label: "Slips"   },
  { href: "/history", label: "History" },
] as const

export function Navbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-[--color-lift] bg-[--color-void]/95 backdrop-blur-sm">
      <nav className="mx-auto flex h-12 max-w-screen-xl items-center justify-between px-4 sm:px-6">

        {/* Logo lockup */}
        <Link href="/" className="flex items-center">
          <Logo size={18} />
        </Link>

        {/* Nav links */}
        <ul className="flex items-center gap-6">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                    active
                      ? "text-[--color-light]"
                      : "text-[--color-text] hover:text-[--color-light]"
                  )}
                >
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Live badge */}
        <div className="border border-[--color-sky] px-2 py-0.5">
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[--color-accent]">
            Live
          </span>
        </div>

      </nav>
    </header>
  )
}