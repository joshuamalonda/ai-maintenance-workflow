import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_properties",
  title: "List properties",
  description:
    "List properties belonging to the signed-in user's agency, optionally filtered by an address or postcode search term.",
  inputSchema: {
    search: z.string().optional().describe("Match against address or postcode."),
    limit: z.number().int().optional().describe("Max rows to return (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("properties")
      .select("id, address, postcode, created_at")
      .order("address", { ascending: true })
      .limit(Math.min(Math.max(limit ?? 25, 1), 100));
    if (search) {
      const term = search.replace(/[%,]/g, " ").trim();
      if (term) query = query.or(`address.ilike.%${term}%,postcode.ilike.%${term}%`);
    }
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { properties: data ?? [] },
    };
  },
});
