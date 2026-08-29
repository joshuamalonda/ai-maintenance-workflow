import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCasesTool from "./tools/list-cases";
import getCaseTool from "./tools/get-case";
import updateCaseStatusTool from "./tools/update-case-status";
import listPropertiesTool from "./tools/list-properties";
import listContractorsTool from "./tools/list-contractors";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "ovelo",
  title: "Ovelo",
  version: "0.1.0",
  instructions:
    "Tools for Ovelo, a letting-agency maintenance operations console. Use `list_cases` and `get_case` to review AI-handled maintenance cases, `update_case_status` to move a case through needs_attention / in_progress / completed, and `list_properties` / `list_contractors` for agency records. All data is scoped to the signed-in user's agency.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listCasesTool,
    getCaseTool,
    updateCaseStatusTool,
    listPropertiesTool,
    listContractorsTool,
  ],
});
