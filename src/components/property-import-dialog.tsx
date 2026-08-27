import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { downloadCsv, PROPERTY_IMPORT_TEMPLATE } from "@/lib/csv";
import {
  previewPropertyImport,
  runPropertyImport,
  type ImportAnalysis,
  type ImportResult,
} from "@/lib/property-import.functions";

const btn =
  "inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";
const ghostBtn =
  "inline-flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-brand-tint disabled:opacity-50";

export function PropertyImportDialog() {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const reset = () => {
    setFileName(null);
    setCsv(null);
    setAnalysis(null);
    setResult(null);
    setError(null);
  };

  const preview = useMutation({
    mutationFn: (text: string) => previewPropertyImport({ data: { csv: text } }),
    onSuccess: (data) => {
      setAnalysis(data);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const importer = useMutation({
    mutationFn: (text: string) => runPropertyImport({ data: { csv: text } }),
    onSuccess: async (data) => {
      setResult(data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["properties"] }),
        queryClient.invalidateQueries({ queryKey: ["property-data-summary"] }),
      ]);
      toast.success(`Imported ${data.added} new properties`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleFile = async (file: File) => {
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setError("Please upload a .csv file.");
      return;
    }
    if (file.size > 4_000_000) {
      setError("That file is too large. Split it into smaller batches.");
      return;
    }
    const text = await file.text();
    if (!text.trim()) {
      setError("That file is empty.");
      return;
    }
    setFileName(file.name);
    setCsv(text);
    setResult(null);
    preview.mutate(text);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button className={btn}>
          <Upload className="size-4" /> Import CSV
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import properties</DialogTitle>
          <DialogDescription>
            Upload a CSV of properties with their tenant and landlord. Nothing is saved until you
            confirm.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Added" value={result.added} />
              <Stat label="Updated" value={result.updated} />
              <Stat label="Skipped" value={result.skipped} />
              <Stat label="Warnings" value={result.warnings} />
            </div>
            <p className="text-sm text-muted-foreground">
              Import complete. Start with these pilot properties — you can upload more at any time,
              and re-uploading the same file will not create duplicates.
            </p>
            {result.messages.length > 0 && (
              <ul className="space-y-1 rounded-md border border-border bg-secondary p-3 text-xs text-muted-foreground">
                {result.messages.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <button className={ghostBtn} onClick={reset}>
                Import another file
              </button>
              <button className={btn} onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              className={`rounded-lg border border-dashed p-6 text-center transition-colors ${
                dragging ? "border-primary bg-brand-tint" : "border-border"
              }`}
            >
              <FileUp className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-2 text-sm text-ink">
                {fileName ?? "Drag a CSV here, or choose a file"}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button className={ghostBtn} onClick={() => inputRef.current?.click()}>
                  Choose file
                </button>
                <button
                  className={ghostBtn}
                  onClick={() => downloadCsv("ovelo-property-template.csv", PROPERTY_IMPORT_TEMPLATE)}
                >
                  <Download className="size-4" /> Download template
                </button>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                property_address, postcode, tenant_name, tenant_phone, landlord_name, landlord_phone
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {preview.isPending && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Checking your file…
              </p>
            )}

            {analysis && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Rows" value={analysis.totalRows} />
                  <Stat label="Valid" value={analysis.validRows} />
                  <Stat label="Warnings" value={analysis.warningRows} />
                  <Stat label="Errors" value={analysis.errorRows} />
                </div>

                {analysis.fileIssues.length > 0 && (
                  <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                    {analysis.fileIssues.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}

                <p className="text-xs text-muted-foreground">
                  {analysis.createCount} new · {analysis.updateCount} existing will be topped up ·{" "}
                  {analysis.skipCount} skipped
                </p>

                <div className="overflow-hidden rounded-md border border-border">
                  <div className="hidden grid-cols-[3rem_1.6fr_6rem_1fr_1fr_5rem] gap-2 border-b border-border bg-secondary px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
                    <span>Row</span>
                    <span>Address</span>
                    <span>Postcode</span>
                    <span>Tenant</span>
                    <span>Landlord</span>
                    <span>Action</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {analysis.preview.map((row) => (
                      <div
                        key={row.line}
                        className="grid gap-1 border-b border-border px-3 py-2 text-xs last:border-b-0 sm:grid-cols-[3rem_1.6fr_6rem_1fr_1fr_5rem] sm:items-center sm:gap-2"
                      >
                        <span className="font-mono text-muted-foreground">{row.line}</span>
                        <span className="truncate text-ink">{row.address || "—"}</span>
                        <span className="font-mono text-muted-foreground">{row.postcode ?? "—"}</span>
                        <span className="truncate text-muted-foreground">
                          {row.tenant_name ?? "—"}
                          {row.tenant_phone ? ` · ${row.tenant_phone}` : ""}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {row.landlord_name ?? "—"}
                          {row.landlord_phone ? ` · ${row.landlord_phone}` : ""}
                        </span>
                        <span
                          className={
                            row.action === "skip"
                              ? "text-destructive"
                              : row.action === "update"
                                ? "text-muted-foreground"
                                : "text-ink"
                          }
                        >
                          {row.action}
                        </span>
                        {row.issues.length > 0 && (
                          <ul className="text-[11px] text-muted-foreground sm:col-span-6">
                            {row.issues.map((issue, i) => (
                              <li
                                key={i}
                                className={issue.level === "error" ? "text-destructive" : undefined}
                              >
                                {issue.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {analysis.previewTruncated && (
                  <p className="text-xs text-muted-foreground">
                    Showing the first {analysis.preview.length} rows — all {analysis.totalRows} will
                    be imported.
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <button className={ghostBtn} onClick={reset} disabled={importer.isPending}>
                    Start over
                  </button>
                  <button
                    className={btn}
                    disabled={importer.isPending || analysis.validRows === 0 || !csv}
                    onClick={() => csv && importer.mutate(csv)}
                  >
                    {importer.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Importing…
                      </>
                    ) : (
                      `Import properties (${analysis.validRows})`
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}
