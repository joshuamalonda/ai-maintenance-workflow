import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Keeps maintenance case queries in sync with the database in real time. */
export function useCasesRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("maintenance_cases_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "maintenance_cases" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["maintenance_cases"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
