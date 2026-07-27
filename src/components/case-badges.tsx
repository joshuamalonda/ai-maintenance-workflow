const urgencyStyles: Record<string, string> = {
  critical: "bg-critical/12 text-critical border-critical/30",
  high: "bg-high/12 text-high border-high/30",
  medium: "bg-medium/15 text-medium border-medium/35",
  low: "bg-low/12 text-low border-low/30",
};

const statusLabels: Record<string, string> = {
  needs_attention: "Needs attention",
  in_progress: "In progress",
  completed: "Completed",
};

export function UrgencyBadge({ urgency }: { urgency: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${
        urgencyStyles[urgency] ?? urgencyStyles.low
      }`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {urgency}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
      {statusLabels[status] ?? status}
    </span>
  );
}

export function CategoryTag({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-accent-foreground">
      {category}
    </span>
  );
}

export { statusLabels };