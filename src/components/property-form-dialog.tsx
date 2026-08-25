import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { EntityPicker } from "@/components/entity-picker";
import {
  createLandlord,
  createProperty,
  createTenant,
  listLandlords,
  listTenants,
  updateProperty,
} from "@/lib/properties.functions";

const inputClass =
  "w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-foreground focus:border-primary";

export function PropertyFormDialog({
  trigger,
  property,
  onSaved,
}: {
  trigger: ReactNode;
  property?: {
    id: string;
    address: string;
    postcode: string | null;
    landlord_id: string | null;
    tenant_id: string | null;
  };
  onSaved?: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(property?.address ?? "");
  const [postcode, setPostcode] = useState(property?.postcode ?? "");
  const [landlordId, setLandlordId] = useState<string | null>(property?.landlord_id ?? null);
  const [tenantId, setTenantId] = useState<string | null>(property?.tenant_id ?? null);

  useEffect(() => {
    if (!open) return;
    setAddress(property?.address ?? "");
    setPostcode(property?.postcode ?? "");
    setLandlordId(property?.landlord_id ?? null);
    setTenantId(property?.tenant_id ?? null);
  }, [open, property]);

  const landlords = useQuery({
    queryKey: ["landlords"],
    queryFn: () => listLandlords(),
    enabled: open,
  });
  const tenants = useQuery({
    queryKey: ["tenants"],
    queryFn: () => listTenants(),
    enabled: open,
  });

  const newLandlord = useMutation({
    mutationFn: (input: { name: string; phone: string; email: string }) =>
      createLandlord({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["landlords"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const newTenant = useMutation({
    mutationFn: (input: { name: string; phone: string; email: string }) =>
      createTenant({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenants"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        address: address.trim(),
        postcode: postcode.trim() || null,
        landlord_id: landlordId,
        tenant_id: tenantId,
      };
      if (property) {
        await updateProperty({ data: { ...payload, id: property.id } });
        return property.id;
      }
      const row = await createProperty({ data: payload });
      return row.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success(property ? "Property updated" : "Property added");
      setOpen(false);
      onSaved?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{property ? "Edit property" : "Add property"}</DialogTitle>
          <DialogDescription>
            Link the property to an existing landlord and tenant, or create new records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Address
              </p>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="12 Fairfield Road, London"
                className={inputClass}
              />
            </div>
            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Postcode
              </p>
              <input
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="E3 2QB"
                className={inputClass}
              />
            </div>
          </div>

          <EntityPicker
            label="Landlord"
            options={landlords.data ?? []}
            value={landlordId}
            onChange={setLandlordId}
            creating={newLandlord.isPending}
            createLabel="Add a new landlord"
            onCreate={async (input) => {
              try {
                return await newLandlord.mutateAsync(input);
              } catch {
                return null;
              }
            }}
          />

          <EntityPicker
            label="Tenant"
            options={tenants.data ?? []}
            value={tenantId}
            onChange={setTenantId}
            creating={newTenant.isPending}
            createLabel="Add a new tenant"
            onCreate={async (input) => {
              try {
                return await newTenant.mutateAsync(input);
              } catch {
                return null;
              }
            }}
          />
        </div>

        <DialogFooter>
          <button
            type="button"
            disabled={!address.trim() || save.isPending}
            onClick={() => save.mutate()}
            className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : property ? "Save changes" : "Add property"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
