import { Link } from "@tanstack/react-router";

import logo from "@/assets/satphonix-logo.png.asset.json";

export function SiteHeader({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo.url} alt="Satphonix" className="h-8 w-8" />
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight">Satphonix</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Business Builder</span>
          </span>
        </Link>
        {!minimal && (
          <Link
            to="/build"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-ink-foreground transition-opacity hover:opacity-90"
          >
            Build my website
          </Link>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Satphonix Business Development</p>
        <p className="max-w-md">
          You know your business. We know technology. Tell us where you want to go, and we'll design the digital system
          to get you there.
        </p>
      </div>
    </footer>
  );
}
