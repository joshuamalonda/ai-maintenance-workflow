import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { getCase, getRecordingUrl } from "@/lib/cases.functions";
import { CategoryTag, StatusBadge, UrgencyBadge, statusLabels } from "@/components/case-badges";
import { useCasesRealtime } from "@/hooks/use-cases-realtime";
import { DeleteCaseButton } from "@/components/delete-case-button";
import { TranscriptView } from "@/components/transcript-view";
import { ChannelBadge, channelLabel, normaliseChannel } from "@/components/channel-badge";
import { CallRecordingPlayer } from "@/components/call-recording-player";
import { LinkedPropertyPanel } from "@/components/link-property-panel";
import { AssignContractorPanel } from "@/components/assign-contractor-panel";
import { CaseWorkflowPanel } from "@/components/case-workflow-panel";

const caseQuery = (id: string) =>
  queryOptions({
    queryKey: ["maintenance_cases", id],
    queryFn: () => getCase({ data: { id } }),
  });

const recordingQuery = (id: string, hasRecording: boolean) =>
  queryOptions({
    queryKey: ["maintenance_cases", id, "recording"],
    queryFn: () => getRecordingUrl({ data: { id } }),
    enabled: hasRecording,
    staleTime: 30 * 60 * 1000,
  });

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  loader: async ({ context, params }) => {
    const found = await context.queryClient.ensureQueryData(caseQuery(params.caseId));
    if (!found) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Maintenance case — Ovelo" },
      {
        name: "description",
        content:
          "Full maintenance case detail: tenant and property information, issue description, summary, recommended action and status.",
      },
      { property: "og:title", content: "Maintenance case — Ovelo" },
      {
        property: "og:description",
        content: "Full detail for a maintenance case handled in Ovelo.",
      },
    ],
  }),
  errorComponent: () => <Fallback title="This case didn't load" />,
  notFoundComponent: () => <Fallback title="Case not found" />,
  component: CaseDetail,
});

function Fallback({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <Link
        to="/cases"
        className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        Back to maintenance cases
      </Link>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  );
}

function Panel({
  title,
  children,
  aside,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {aside}
      </div>
      <div className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function CaseDetail() {
  useCasesRealtime();
  const { caseId } = Route.useParams();
  const { data } = useSuspenseQuery(caseQuery(caseId));
  const { data: recordingUrl } = useQuery(
    recordingQuery(caseId, Boolean(data?.call_recording_url)),
  );
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  if (!data) return <Fallback title="Case not found" />;

  const channel = normaliseChannel(data.communication_channel);
  const isPhone = channel === "phone";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <Link to="/cases" className="text-sm font-medium text-primary hover:underline">
        ← Maintenance cases
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{data.reference_code}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {data.issue_category} — {data.tenant_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{data.property_address}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ChannelBadge channel={channel} />
          <UrgencyBadge urgency={data.urgency} />
          <StatusBadge status={data.status} />
          <DeleteCaseButton
            caseId={data.id}
            reference={data.reference_code}
            variant="button"
            redirectToList
          />
        </div>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-lg border border-primary/25 bg-brand-tint p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-accent-foreground">
                Summary
              </h2>
              {data.ai_confidence != null && (
                <span className="font-mono text-xs text-accent-foreground">
                  confidence {Math.round(Number(data.ai_confidence) * 100)}%
                </span>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink">
              {data.ai_summary ??
                "No summary has been produced for this case yet. It appears once the first tenant exchange has been processed."}
            </p>
          </section>

          <Panel title="Issue description">{data.issue_description}</Panel>

          {data.call_recording_url && (
            <Panel
              title="Call recording"
              aside={
                data.call_duration_secs != null ? (
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {data.call_duration_secs}s
                  </span>
                ) : undefined
              }
            >
              {recordingUrl ? (
                <CallRecordingPlayer src={recordingUrl} fallbackDuration={data.call_duration_secs} />
              ) : (
                "Preparing recording…"
              )}
            </Panel>
          )}

          <Panel title="Recommended action">
            {data.recommended_action ??
              data.last_ai_action ??
              "No recommended action recorded for this case yet."}
          </Panel>

          {data.troubleshooting && <Panel title="Troubleshooting">{data.troubleshooting}</Panel>}

          {data.missing_information && (
            <Panel title="Missing information">{data.missing_information}</Panel>
          )}

          <section className="rounded-lg border border-border bg-surface">
            <button
              type="button"
              onClick={() => setTranscriptOpen((v) => !v)}
              aria-expanded={transcriptOpen}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                Transcript
                <span className="font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground">
                  {channelLabel(channel)}
                </span>
              </span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${
                  transcriptOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {transcriptOpen && (
              <div className="border-t border-border px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                {data.transcript ? (
                  <TranscriptView
                    transcript={data.transcript}
                    tenantName={data.tenant_name}
                    channel={channel}
                  />
                ) : (
                  "No transcript is stored for this case."
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <LinkedPropertyPanel caseRecord={data} />
          <CaseWorkflowPanel caseRecord={data} />
          <AssignContractorPanel caseRecord={data} />
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-ink">Case information</h2>
            <dl className="mt-2">
              <Field label="Tenant name" value={data.tenant_name} />
              <Field label="Property address" value={data.property_address} />
              <Field label="Issue category" value={data.issue_category} />
              <Field label="Urgency" value={data.urgency} />
              <Field label="Status" value={statusLabels[data.status] ?? data.status} />
              <Field label="Channel" value={channelLabel(channel)} />
              {data.preferred_language && (
                <Field label="Preferred language" value={data.preferred_language} />
              )}
              {isPhone && data.call_duration_secs != null && (
                <Field label="Call duration" value={`${data.call_duration_secs}s`} />
              )}
              <Field label="Reported" value={new Date(data.created_at).toLocaleString("en-GB")} />
              <Field
                label="Last updated"
                value={new Date(data.updated_at).toLocaleString("en-GB")}
              />
            </dl>
            <div className="mt-4">
              <CategoryTag category={data.issue_category} />
            </div>
            {(data.call_sid || data.conversation_id || data.priority) && (
              <details className="mt-4 border-t border-border pt-3">
                <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Technical details
                </summary>
                <dl className="mt-1">
                  {data.priority && <Field label="AI priority" value={data.priority} />}
                  {isPhone && data.call_sid && (
                    <Field label="Call reference" value={data.call_sid} />
                  )}
                  {data.conversation_id && (
                    <Field label="Conversation ID" value={data.conversation_id} />
                  )}
                </dl>
              </details>
            )}
          </div>
        </aside>

      </div>
    </div>
  );
}
