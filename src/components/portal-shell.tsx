import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";

import logo from "@/assets/satphonix-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

export function PortalShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    await navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-5">
          <Link to="/portal" className="flex items-center gap-2.5">
            <img src={logo.url} alt="Satphonix" className="h-8 w-8" />
            <span className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold tracking-tight">Satphonix</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Client portal</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:py-12">{children}</main>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}
