import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createAgencyContractor,
  updateAgencyContractor,
  type Contractor,
} from "@/lib/contractors.functions";

const inputClass =
  "w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-foreground focus:border-primary";

const labelClass =
  "mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground";

type Draft = {
  name: string;
  company: string;
  trade: string;
  phone: string;
  whatsapp: string;
  email: string;
  active: boolean;
};

const emptyDraft: Draft = {
  name: "",
  company: "",
  trade: "",
  phone: "",
  whatsapp: "",
  email: "",
  active: true,
};

export function ContractorFormDialog({
  trigger,
  contractor,
  onSaved,
}: {
  trigger: ReactNode;
  contractor?: Contractor;
  onSaved?: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  useEffect(() => {
    if (!open) return;
    setDraft(
      contractor
        ? {
            name: contractor.name,
            company: contractor.company ?? "",
            trade: contractor.trade ?? "",
            phone: contractor.phone ?? "",
            whatsapp: contractor.whatsapp ?? "",
            email: contractor.email ?? "",
            active: contractor.active,
          }
        : emptyDraft,
    );
  }, [open, contractor]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: draft.name.trim(),
        company: draft.company,
        trade: draft.trade,
        phone: draft.phone,
        whatsapp: draft.whatsapp,
        email: draft.email,
        active: draft.active,
      };
      if (contractor) {
        const row = await updateAgencyContractor({ data: { ...payload, id: contractor.id } });
        return row.id;
      }
      const row = await createAgencyContractor({ data: payload });
      return row.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      if (contractor) queryClient.invalidateQueries({ queryKey: ["contractors", contractor.id] });
      toast.success(contractor ? "Contractor updated" : "Contractor added");
      setOpen(false);
      onSaved?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contractor ? "Edit contractor" : "Add contractor"}</DialogTitle>
          <DialogDescription>
            Contractors belong to your agency and can be assigned to the properties you manage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className={labelClass}>Contact name</p>
            <input
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Sam Whitfield"
              className={inputClass}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className={labelClass}>Company</p>
              <input
                value={draft.company}
                onChange={(e) => set({ company: e.target.value })}
                placeholder="Whitfield Plumbing Ltd"
                className={inputClass}
              />
            </div>
            <div>
              <p className={labelClass}>Trade</p>
              <input
                value={draft.trade}
                onChange={(e) => set({ trade: e.target.value })}
                placeholder="Plumbing"
                className={inputClass}
              />
            </div>
            <div>
              <p className={labelClass}>Phone</p>
              <input
                value={draft.phone}
                onChange={(e) => set({ phone: e.target.value })}
                placeholder="+44 20 7946 0000"
                className={inputClass}
              />
            </div>
            <div>
              <p className={labelClass}>WhatsApp</p>
              <input
                value={draft.whatsapp}
                onChange={(e) => set({ whatsapp: e.target.value })}
                placeholder="+44 7700 900000"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <p className={labelClass}>Email</p>
            <input
              value={draft.email}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="sam@whitfieldplumbing.co.uk"
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => set({ active: e.target.checked })}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            <span className="text-sm text-ink">Active</span>
            <span className="text-xs text-muted-foreground">
              Inactive contractors stay on file but are flagged as unavailable.
            </span>
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            disabled={!draft.name.trim() || save.isPending}
            onClick={() => save.mutate()}
            className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : contractor ? "Save changes" : "Add contractor"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
