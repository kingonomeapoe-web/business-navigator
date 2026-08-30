import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import logo from "@/assets/satphonix-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { whoAmI } from "@/lib/admin.functions";

type NavItem = { label: string; to: string; ready: boolean };

export const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", to: "/admin", ready: true },
  { label: "Components", to: "/admin/components", ready: true },
  { label: "Pricing", to: "/admin/pricing", ready: true },
  { label: "Projects", to: "/admin/projects", ready: true },
  { label: "Clients", to: "/admin/clients", ready: false },
  { label: "Quotes", to: "/admin/quotes", ready: false },
  { label: "Content", to: "/admin/content", ready: false },
  { label: "Questions", to: "/admin/questions", ready: false },
  { label: "Rules", to: "/admin/rules", ready: false },
  { label: "Industries", to: "/admin/industries", ready: false },
  { label: "Settings", to: "/admin/settings", ready: false },
];

export function AdminShell({
  children,
  breadcrumbs = [],
}: {
  children: ReactNode;
  breadcrumbs?: { label: string; to?: string }[];
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const me = useServerFn(whoAmI);
  const { data: identity } = useQuery({ queryKey: ["admin-whoami"], queryFn: () => me(), retry: false });

  const signOut = async () => {
    await supabase.auth.signOut();
    await navigate({ to: "/auth" });
  };

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {ADMIN_NAV.map((item) => {
        const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span>{item.label}</span>
            {!item.ready && <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">soon</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="hidden w-60 shrink-0 border-r border-border/60 bg-card/40 p-4 lg:block">
        <Link to="/admin" className="mb-6 flex items-center gap-2.5 px-1">
          <img src={logo.url} alt="Satphonix" className="h-8 w-8" />
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight">Satphonix</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Control centre</span>
          </span>
        </Link>
        {nav}
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Toggle navigation"
                onClick={() => setOpen((v) => !v)}
                className="rounded-lg border border-border p-2 lg:hidden"
              >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
              <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <li>
                  <Link to="/admin" className="hover:text-foreground">
                    Admin
                  </Link>
                </li>
                {breadcrumbs.map((crumb) => (
                  <li key={crumb.label} className="flex items-center gap-1.5">
                    <span aria-hidden>/</span>
                    {crumb.to ? (
                      <Link to={crumb.to} className="hover:text-foreground">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-foreground">{crumb.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {identity?.email} · {identity?.role ?? "—"}
              </span>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          </div>
          {open && <div className="mt-3 lg:hidden">{nav}</div>}
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

export function ComingSoon({ title }: { title: string }) {
  return (
    <AdminShell breadcrumbs={[{ label: title }]}>
      <p className="eyebrow">Admin</p>
      <h1 className="display mt-2 text-3xl">{title}</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
        <p className="text-sm text-muted-foreground">Coming in the next phase.</p>
      </div>
    </AdminShell>
  );
}
