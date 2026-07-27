export function OveloMark({ className = "size-7" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-md bg-primary ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-[58%]" fill="none">
        <circle
          cx="12"
          cy="12"
          r="8"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeDasharray="42 8"
          transform="rotate(-35 12 12)"
          className="text-primary-foreground"
        />
      </svg>
    </span>
  );
}

export function OveloWordmark({ subtitle }: { subtitle?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <OveloMark />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold tracking-tight text-ink">
          Ovelo
        </span>
        {subtitle && (
          <span className="block truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}