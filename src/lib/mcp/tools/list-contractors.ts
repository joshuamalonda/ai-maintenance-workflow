import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_contractors",
  title: "List contractors",
  description: "List contractors on file for the signed-in user's agency.",
  inputSchema: {
    active_only: z.boolean().optional().describe("Only return active contractors."),
    trade: z.string().optional().describe("Filter by trade, e.g. Plumbing."),
    limit: z.number().int().optional().describe("Max rows to return (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ active_only, trade, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("contractors")
      .select("id, name, company, trade, phone, email, active")
      .order("name", { ascending: true })
      .limit(Math.min(Math.max(limit ?? 25, 1), 100));
    if (active_only) query = query.eq("active", true);
    if (trade) query = query.ilike("trade", `%${trade}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { contractors: data ?? [] },
    };
  },
});
