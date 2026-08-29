import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_case",
  title: "Get case details",
  description:
    "Fetch one maintenance case by its id or reference code (e.g. MC-000123), including AI summary and workflow fields.",
  inputSchema: {
    id: z.string().optional().describe("Case UUID."),
    reference_code: z.string().optional().describe("Case reference code, e.g. MC-000123."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, reference_code }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    if (!id && !reference_code)
      return {
        content: [{ type: "text", text: "Provide either id or reference_code." }],
        isError: true,
      };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("maintenance_cases")
      .select(
        "id, reference_code, tenant_name, property_address, issue_category, issue_description, urgency, status, priority, ai_summary, ai_confidence, recommended_action, contractor_required, contractor_response_status, appointment_at, landlord_decision, source_channel, communication_channel, created_at, updated_at",
      )
      .limit(1);
    query = id ? query.eq("id", id) : query.eq("reference_code", reference_code!);
    const { data, error } = await query.maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Case not found" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { case: data },
    };
  },
});
