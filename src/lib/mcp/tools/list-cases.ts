import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_cases",
  title: "List maintenance cases",
  description:
    "List maintenance cases for the signed-in user's agency, newest first. Optionally filter by workflow status or urgency.",
  inputSchema: {
    status: z
      .enum(["needs_attention", "in_progress", "completed"])
      .optional()
      .describe("Workflow status filter."),
    urgency: z.string().optional().describe("Urgency value filter, e.g. high."),
    limit: z.number().int().optional().describe("Max rows to return (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, urgency, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("maintenance_cases")
      .select(
        "id, reference_code, tenant_name, property_address, issue_category, urgency, status, ai_summary, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 25, 1), 100));
    if (status) query = query.eq("status", status);
    if (urgency) query = query.eq("urgency", urgency);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { cases: data ?? [] },
    };
  },
});
