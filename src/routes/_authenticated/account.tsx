import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getAgencyAccount,
  setAgencyNotificationPhone,
  type AgencyAccount,
} from "@/lib/account.functions";
import { isValidNotificationPhone, toE164 } from "@/lib/phone";

const accountQuery = queryOptions({
  queryKey: ["agency-account"],
  queryFn: () => getAgencyAccount(),
});

export const Route = createFileRoute("/_authenticated/account")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(accountQuery);
  },
  head: () => ({
    meta: [
      { title: "Account — Ovelo" },
      {
        name: "description",
        content:
          "Manage your Ovelo agency account settings, including the mobile number used for maintenance-case SMS updates.",
      },
      { property: "og:title", content: "Account — Ovelo" },
      {
        property: "og:description",
        content: "Agency account and notification settings for Ovelo maintenance operations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div role="alert" className="mx-auto max-w-2xl px-6 py-24 text-center text-sm text-ink">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center text-sm text-ink">Not found</div>
  ),
  component: AccountPage,
});

const inputClass =
  "w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-foreground focus:border-primary";

const labelClass =
  "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground";

function AccountPage() {
  const { data: agency } = useSuspenseQuery(accountQuery);
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState(agency?.notification_phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPhone(agency?.notification_phone ?? "");
  }, [agency?.notification_phone]);

  const mutation = useMutation({
    mutationFn: (value: string | null) =>
      setAgencyNotificationPhone({ data: { agencyId: agency!.id, phone: value } }),
    onSuccess: (updated: AgencyAccount) => {
      queryClient.setQueryData(accountQuery.queryKey, updated);
      setSaved(true);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setSaved(false);
    },
  });

  if (!agency) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">
          No agency is linked to your account yet.
        </p>
      </div>
    );
  }

  const current = agency.notification_phone;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Settings for {agency.name}. These apply to everyone in your workspace.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Notifications</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ovelo sends SMS updates to this number for maintenance-case milestones: a new case is
          logged, a contractor is assigned, and a contractor accepts or declines a job. Email
          notifications will be added later.
        </p>

        <form
          className="mt-5 max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = phone.trim();
            if (!trimmed) {
              setError("Enter a mobile number, or use Remove to clear it.");
              return;
            }
            if (!isValidNotificationPhone(trimmed)) {
              setError("Enter a valid UK mobile number, e.g. 07700 900123.");
              return;
            }
            setError(null);
            mutation.mutate(trimmed);
          }}
        >
          <label className={labelClass} htmlFor="notification-phone">
            Agency notification number
          </label>
          <input
            id="notification-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="07700 900123"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setSaved(false);
            }}
            className={inputClass}
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            UK mobile numbers are stored in international format
            {phone.trim() && isValidNotificationPhone(phone) ? ` (${toE164(phone)})` : ""}.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : current ? "Save changes" : "Save number"}
            </button>
            {current && (
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => {
                  setError(null);
                  setPhone("");
                  mutation.mutate(null);
                }}
                className="rounded-md border border-border px-3 py-2 text-xs font-medium text-destructive transition-colors hover:border-destructive disabled:opacity-50"
              >
                Remove
              </button>
            )}
            {saved && !error && (
              <span className="text-xs text-muted-foreground">Saved</span>
            )}
          </div>

          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </form>

        <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          Current number:{" "}
          <span className="font-medium text-ink">{current ?? "Not set"}</span>
        </p>
      </section>
    </div>
  );
}
