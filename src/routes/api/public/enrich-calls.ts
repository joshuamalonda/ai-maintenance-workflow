import { createFileRoute } from "@tanstack/react-router";

// Scheduled post-call enrichment trigger. Called by pg_cron every 5 minutes
// with the project's publishable key in the `apikey` header. Safe to call
// repeatedly: the job is idempotent and never creates cases.
export const Route = createFileRoute("/api/public/enrich-calls")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedKey = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        const provided =
          request.headers.get("apikey") ??
          (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
        if (!expectedKey || provided !== expectedKey) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const apiKey = process.env["TELNYX_API_KEY"];
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "TELNYX_API_KEY not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { runEnrichment } = await import("@/lib/telnyx-enrich.server");
        try {
          const summary = await runEnrichment(apiKey);
          return new Response(JSON.stringify({ ok: true, ...summary }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("[enrich] run failed", error);
          return new Response(
            JSON.stringify({ ok: false, error: (error as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});