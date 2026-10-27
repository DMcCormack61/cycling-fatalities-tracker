import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Gauge, LayoutDashboard, List, MapPinned, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/crashes", label: "Crashes", icon: List },
  { to: "/states", label: "States", icon: MapPinned },
  { to: "/traffic", label: "Traffic", icon: Gauge },
  { to: "/briefing", label: "Briefing", icon: BookOpen },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-40 bg-navy text-cream">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-cream">
            <BrandMark className="h-9 w-9" />
            <span className="flex flex-col leading-none">
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em]">
                Cycling Fatalities
              </span>
              <span className="mt-1 text-[0.625rem] uppercase tracking-[0.14em] text-cream/65">
                KSI Tracker
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active =
                item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-sm px-3 py-2 text-sm transition-colors duration-150",
                    active ? "bg-cream/12 text-cream" : "text-cream/70 hover:text-cream",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="inverse"
              size="icon"
              className="md:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {open ? (
          <nav className="border-t border-cream/15 px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => {
                const active =
                  item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm",
                      active ? "bg-cream/12 text-cream" : "text-cream/75",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Cycling Fatalities Tracker · US KSI desk · Curated public reports</p>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <Link to="/traffic" className="text-subtle underline-offset-4 hover:text-fg hover:underline">
              Traffic volume
            </Link>
            <Link to="/briefing" className="text-subtle underline-offset-4 hover:text-fg hover:underline">
              How to read this desk
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
