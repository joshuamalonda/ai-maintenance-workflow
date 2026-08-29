import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_case_status",
  title: "Update case status",
  description:
    "Set the workflow status of a maintenance case owned by the signed-in user's agency.",
  inputSchema: {
    id: z.string().describe("Case UUID."),
    status: z
      .enum(["needs_attention", "in_progress", "completed"])
      .describe("New workflow status."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ id, status }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("maintenance_cases")
      .update({ status })
      .eq("id", id)
      .select("id, reference_code, status")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: "Case not found or not accessible" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { case: data },
    };
  },
});
