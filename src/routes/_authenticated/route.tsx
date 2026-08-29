import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { getMyAgency } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // A signed-in user without an agency membership must onboard first.
    const agency = await getMyAgency();
    if (!agency) throw redirect({ to: "/onboarding" });
    return { user: data.user, agency };
  },

  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
