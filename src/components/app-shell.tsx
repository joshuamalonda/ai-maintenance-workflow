import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { LayoutDashboard, ListChecks, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OveloWordmark } from "@/components/ovelo-logo";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/cases", label: "Cases", icon: ListChecks, exact: false },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="space-y-0.5">
      {nav.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-primary font-medium text-primary-foreground"
                : "text-ink hover:bg-brand-tint"
            }`}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <OveloWordmark subtitle="Operations" />
      <div className="min-h-0 flex-1">
        <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Workspace
        </p>
        <NavLinks onNavigate={onNavigate} />
      </div>
      <p className="px-3 text-[11px] leading-relaxed text-muted-foreground">
        Ovelo Technologies
      </p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-surface lg:sticky lg:top-0 lg:block lg:h-screen">
        <SidebarBody />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-border bg-surface">
            <SidebarBody onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setOpen(true)}
                aria-label="Open navigation"
                className="rounded-md border border-input p-1.5 text-ink lg:hidden"
              >
                {open ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
              <span className="truncate text-sm font-medium text-ink lg:hidden">Ovelo</span>
              <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground lg:inline">
                Maintenance operations
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {email && (
                <span className="hidden max-w-[16rem] truncate text-xs text-muted-foreground sm:inline">
                  {email}
                </span>
              )}
              <button
                onClick={signOut}
                className="rounded-md border border-input px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-brand-tint"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}