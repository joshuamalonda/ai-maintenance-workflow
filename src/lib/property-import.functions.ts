import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ImportAnalysis, ImportResult } from "@/lib/property-import.server";

export type { ImportAnalysis, ImportResult, AnalysedRow, RowIssue } from "@/lib/property-import.server";

type Client = SupabaseClient<Database>;

const csvInput = (input: unknown) => z.object({ csv: z.string().min(1).max(4_000_000) }).parse(input);

export const getPropertyDataSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [properties, tenants, landlords] = await Promise.all([
      context.supabase.from("properties").select("id", { count: "exact", head: true }),
      context.supabase.from("tenants").select("id", { count: "exact", head: true }),
      context.supabase.from("landlords").select("id", { count: "exact", head: true }),
    ]);
    return {
      properties: properties.count ?? 0,
      tenants: tenants.count ?? 0,
      landlords: landlords.count ?? 0,
    };
  });

export const previewPropertyImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(csvInput)
  .handler(async ({ data, context }): Promise<ImportAnalysis> => {
    const { analyseImport } = await import("@/lib/property-import.server");
    const { analysis } = await analyseImport(context.supabase as Client, data.csv);
    return analysis;
  });

export const runPropertyImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(csvInput)
  .handler(async ({ data, context }): Promise<ImportResult> => {
    const { applyImport } = await import("@/lib/property-import.server");
    return applyImport(context.supabase as Client, data.csv);
  });

export const exportPropertiesCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildPropertyExport } = await import("@/lib/property-import.server");
    return buildPropertyExport(context.supabase as Client);
  });
