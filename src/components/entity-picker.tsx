import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";

export type PickerOption = { id: string; name: string; phone?: string | null; email?: string | null };

const inputClass =
  "w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-foreground focus:border-primary";

/**
 * Search-and-select control that reuses existing records and only creates a
 * new one when the user explicitly chooses to.
 */
export function EntityPicker({
  label,
  options,
  value,
  onChange,
  onCreate,
  creating,
  createLabel,
}: {
  label: string;
  options: PickerOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  onCreate: (input: { name: string; phone: string; email: string }) => Promise<PickerOption | null>;
  creating?: boolean;
  createLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", email: "" });

  const selected = options.find((o) => o.id === value) ?? null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter((o) =>
          [o.name, o.phone ?? "", o.email ?? ""].join(" ").toLowerCase().includes(q),
        )
      : options;
    return list.slice(0, 8);
  }, [options, query]);

  if (selected) {
    return (
      <div>
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-brand-tint px-3 py-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{selected.name}</span>
            {(selected.phone || selected.email) && (
              <span className="block truncate text-xs text-muted-foreground">
                {[selected.phone, selected.email].filter(Boolean).join(" · ")}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 rounded-md border border-input bg-surface p-1.5 text-ink"
            aria-label={`Clear ${label}`}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>

      {!adding && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search existing ${label.toLowerCase()}s`}
              className={`${inputClass} pl-8`}
            />
          </div>
          <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-border">
            {results.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">No matches.</p>
            ) : (
              results.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onChange(o.id)}
                  className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm text-ink transition-colors last:border-b-0 hover:bg-brand-tint"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{o.name}</span>
                    {(o.phone || o.email) && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {[o.phone, o.email].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <Check className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setDraft({ name: query.trim(), phone: "", email: "" });
              setAdding(true);
            }}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="size-3.5" /> {createLabel}
          </button>
        </>
      )}

      {adding && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Full name"
            className={inputClass}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              placeholder="Phone (optional)"
              className={inputClass}
            />
            <input
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="Email (optional)"
              className={inputClass}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!draft.name.trim() || creating}
              onClick={async () => {
                const created = await onCreate(draft);
                if (created) {
                  onChange(created.id);
                  setAdding(false);
                  setDraft({ name: "", phone: "", email: "" });
                }
              }}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {creating ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
