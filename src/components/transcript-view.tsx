import { useMemo, useState } from "react";
import { Bot, Check, Copy, User } from "lucide-react";
import { toast } from "sonner";

export type TranscriptTurn = {
  speaker: "assistant" | "user";
  text: string;
  timestamp?: string;
};

const SPEAKER_LABEL: Record<TranscriptTurn["speaker"], string> = {
  assistant: "Ovelo AI",
  user: "Tenant",
};

const TURN_RE = /^\s*(assistant|user|ai|agent|tenant|caller)\s*(?:\[([^\]]+)\])?\s*:\s*/i;

function normaliseSpeaker(raw: string): TranscriptTurn["speaker"] {
  const v = raw.toLowerCase();
  return v === "user" || v === "tenant" || v === "caller" ? "user" : "assistant";
}

export function parseTranscript(transcript: string): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  let current: TranscriptTurn | null = null;

  for (const line of transcript.split("\n")) {
    const match = line.match(TURN_RE);
    if (match) {
      if (current) turns.push({ ...current, text: current.text.trim() });
      current = {
        speaker: normaliseSpeaker(match[1]),
        text: line.slice(match[0].length),
        ...(match[2] ? { timestamp: match[2] } : {}),
      };
    } else if (current) {
      current.text += `\n${line}`;
    } else if (line.trim()) {
      current = { speaker: "assistant", text: line };
    }
  }
  if (current) turns.push({ ...current, text: current.text.trim() });

  return turns.filter((t) => t.text.length > 0);
}

function toPlainText(turns: TranscriptTurn[]) {
  return turns.map((t) => `${SPEAKER_LABEL[t.speaker]}: ${t.text}`).join("\n\n");
}

function Turn({ turn }: { turn: TranscriptTurn }) {
  const isTenant = turn.speaker === "user";
  const Icon = isTenant ? User : Bot;

  return (
    <li className={`flex flex-col ${isTenant ? "items-end" : "items-start"}`}>
      <div
        className={`flex items-center gap-1.5 px-1 ${isTenant ? "flex-row-reverse" : ""}`}
      >
        <span
          className={`inline-flex size-5 items-center justify-center rounded-full border ${
            isTenant
              ? "border-border bg-secondary text-muted-foreground"
              : "border-primary/25 bg-brand-tint text-accent-foreground"
          }`}
        >
          <Icon className="size-3" aria-hidden />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {SPEAKER_LABEL[turn.speaker]}
        </span>
      </div>

      <div
        className={`mt-1.5 max-w-[88%] rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[78%] ${
          isTenant
            ? "rounded-tr-sm border-border bg-secondary text-ink"
            : "rounded-tl-sm border-primary/20 bg-brand-tint text-ink"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{turn.text}</p>
      </div>

      {turn.timestamp && (
        <span className="mt-1 px-1 font-mono text-[10px] text-muted-foreground">
          {turn.timestamp}
        </span>
      )}
    </li>
  );
}

export function TranscriptView({ transcript }: { transcript: string }) {
  const turns = useMemo(() => parseTranscript(transcript), [transcript]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(turns));
      setCopied(true);
      toast.success("Transcript copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy transcript");
    }
  };

  if (turns.length === 0) {
    return <p className="whitespace-pre-wrap">{transcript}</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {turns.length} {turns.length === 1 ? "turn" : "turns"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-secondary"
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          Copy transcript
        </button>
      </div>

      <ul className="mt-4 max-h-[32rem] space-y-5 overflow-y-auto pr-1">
        {turns.map((turn, i) => (
          <Turn key={i} turn={turn} />
        ))}
      </ul>
    </div>
  );
}