/**
 * CSV property-import engine for agency onboarding.
 *
 * Reuses the existing directory model (properties / tenants / landlords), the
 * existing address normalisation from the case matcher and the existing UK
 * phone normalisation. All reads and writes go through the caller's
 * RLS-scoped Supabase client, so agency isolation is preserved.
 *
 * Nothing here touches maintenance cases, contractors, notifications or the
 * fuzzy case-to-property matching thresholds.
 */
import { parseCsv, PROPERTY_IMPORT_COLUMNS } from "@/lib/csv";
import { normaliseAddress, extractPostcode } from "@/lib/matching.server";
import { toE164, isValidE164 } from "@/lib/phone";

import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export const MAX_IMPORT_ROWS = 5000;
export const PREVIEW_ROW_LIMIT = 100;

export type RowIssue = { level: "error" | "warning"; message: string };

export type AnalysedRow = {
  line: number;
  address: string;
  postcode: string | null;
  tenant_name: string | null;
  tenant_phone: string | null;
  landlord_name: string | null;
  landlord_phone: string | null;
  key: string;
  action: "create" | "update" | "skip";
  issues: RowIssue[];
};

export type ImportAnalysis = {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  preview: AnalysedRow[];
  previewTruncated: boolean;
  fileIssues: string[];
};

export type ImportResult = {
  added: number;
  updated: number;
  skipped: number;
  warnings: number;
  errors: number;
  messages: string[];
};

export function normalisePostcode(value: string | null | undefined): string | null {
  const raw = (value ?? "").toUpperCase().replace(/\s+/g, "");
  if (!raw) return null;
  const match = /^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/.exec(raw);
  return match ? `${match[1]} ${match[2]}` : raw;
}

/** Identity key for a property inside one agency: normalised address + postcode. */
export function propertyKey(address: string, postcode: string | null): string {
  const pc = normalisePostcode(postcode) ?? "";
  const addr = normaliseAddress(address).replace(pc.toLowerCase().replace(/\s/g, ""), "").trim();
  return `${addr}|${pc}`;
}

export async function currentAgencyId(supabase: Client): Promise<string> {
  const { data, error } = await supabase
    .from("agency_members")
    .select("agency_id")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Your account is not linked to an agency yet.");
  return data.agency_id;
}

const clean = (v: string | undefined) => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};

type ParsedRow = {
  line: number;
  address: string | null;
  postcode: string | null;
  tenant_name: string | null;
  tenant_phone: string | null;
  landlord_name: string | null;
  landlord_phone: string | null;
};

function parseRows(csv: string): { rows: ParsedRow[]; fileIssues: string[] } {
  const fileIssues: string[] = [];
  const table = parseCsv(csv);
  if (table.length === 0) return { rows: [], fileIssues: ["The file is empty."] };

  const header = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const index: Partial<Record<string, number>> = {};
  for (const col of PROPERTY_IMPORT_COLUMNS) {
    const i = header.indexOf(col);
    if (i === -1) fileIssues.push(`Missing column "${col}".`);
    else index[col] = i;
  }
  if (index["property_address"] === undefined) {
    return { rows: [], fileIssues: [...fileIssues, "property_address is required to import."] };
  }

  const at = (row: string[], col: string) => {
    const i = index[col];
    return i === undefined ? null : clean(row[i]);
  };

  const body = table.slice(1);
  if (body.length > MAX_IMPORT_ROWS) {
    fileIssues.push(
      `Only the first ${MAX_IMPORT_ROWS} rows are processed (file has ${body.length}).`,
    );
  }

  const rows = body.slice(0, MAX_IMPORT_ROWS).map((row, i) => ({
    line: i + 2,
    address: at(row, "property_address"),
    postcode: at(row, "postcode"),
    tenant_name: at(row, "tenant_name"),
    tenant_phone: at(row, "tenant_phone"),
    landlord_name: at(row, "landlord_name"),
    landlord_phone: at(row, "landlord_phone"),
  }));

  return { rows, fileIssues };
}

function normalisePhone(raw: string | null): { phone: string | null; invalid: boolean } {
  if (!raw) return { phone: null, invalid: false };
  const e164 = toE164(raw);
  if (e164 && isValidE164(e164)) return { phone: e164, invalid: false };
  return { phone: null, invalid: true };
}

type ExistingProperty = {
  id: string;
  address: string;
  postcode: string | null;
  landlord_id: string | null;
  tenant_id: string | null;
};

async function loadExisting(supabase: Client) {
  const [{ data: properties, error: pErr }, { data: tenants, error: tErr }, { data: landlords, error: lErr }] =
    await Promise.all([
      supabase.from("properties").select("id, address, postcode, landlord_id, tenant_id"),
      supabase.from("tenants").select("id, name, phone"),
      supabase.from("landlords").select("id, name, phone"),
    ]);
  if (pErr) throw new Error(pErr.message);
  if (tErr) throw new Error(tErr.message);
  if (lErr) throw new Error(lErr.message);

  const byKey = new Map<string, ExistingProperty[]>();
  for (const p of (properties ?? []) as ExistingProperty[]) {
    const key = propertyKey(p.address, p.postcode ?? extractPostcode(p.address));
    const list = byKey.get(key) ?? [];
    list.push(p);
    byKey.set(key, list);
  }

  const contactIndex = <T extends { id: string; name: string; phone: string | null }>(rows: T[]) => {
    const map = new Map<string, T>();
    for (const r of rows) map.set(r.name.trim().toLowerCase(), r);
    return map;
  };

  return {
    propertiesByKey: byKey,
    tenants: contactIndex((tenants ?? []) as Array<{ id: string; name: string; phone: string | null }>),
    landlords: contactIndex((landlords ?? []) as Array<{ id: string; name: string; phone: string | null }>),
  };
}

export async function analyseImport(supabase: Client, csv: string): Promise<{
  analysis: ImportAnalysis;
  rows: AnalysedRow[];
}> {
  const { rows: parsed, fileIssues } = parseRows(csv);
  const existing = await loadExisting(supabase);

  const seen = new Map<string, number>();
  const analysed: AnalysedRow[] = [];

  for (const row of parsed) {
    const issues: RowIssue[] = [];
    const address = row.address ?? "";
    if (!address) issues.push({ level: "error", message: "Missing property address." });

    const postcode = normalisePostcode(row.postcode ?? extractPostcode(address));
    if (!postcode) issues.push({ level: "warning", message: "Missing postcode — matching is weaker." });

    const tenant = normalisePhone(row.tenant_phone);
    const landlord = normalisePhone(row.landlord_phone);
    if (!row.tenant_name) issues.push({ level: "warning", message: "No tenant name." });
    if (!row.landlord_name) issues.push({ level: "warning", message: "No landlord name." });
    if (row.tenant_name && !row.tenant_phone)
      issues.push({ level: "warning", message: "Tenant has no phone number." });
    if (row.landlord_name && !row.landlord_phone)
      issues.push({ level: "warning", message: "Landlord has no phone number." });
    if (tenant.invalid) issues.push({ level: "warning", message: "Tenant phone is not a valid number — it will not be imported." });
    if (landlord.invalid) issues.push({ level: "warning", message: "Landlord phone is not a valid number — it will not be imported." });

    const key = address ? propertyKey(address, postcode) : `__invalid__${row.line}`;

    const firstLine = seen.get(key);
    if (address && firstLine) {
      issues.push({ level: "error", message: `Duplicate of row ${firstLine} in this file.` });
    } else if (address) {
      seen.set(key, row.line);
    }

    const matches = existing.propertiesByKey.get(key) ?? [];
    if (matches.length > 1) {
      issues.push({ level: "error", message: "Several existing properties match this address — skipped for review." });
    } else if (matches.length === 1) {
      issues.push({ level: "warning", message: "Already in Ovelo — only missing details will be filled in." });
    }

    const hasError = issues.some((i) => i.level === "error");
    const action: AnalysedRow["action"] = hasError ? "skip" : matches.length === 1 ? "update" : "create";

    analysed.push({
      line: row.line,
      address,
      postcode,
      tenant_name: row.tenant_name,
      tenant_phone: tenant.phone,
      landlord_name: row.landlord_name,
      landlord_phone: landlord.phone,
      key,
      action,
      issues,
    });
  }

  const analysis: ImportAnalysis = {
    totalRows: analysed.length,
    validRows: analysed.filter((r) => r.action !== "skip").length,
    errorRows: analysed.filter((r) => r.issues.some((i) => i.level === "error")).length,
    warningRows: analysed.filter((r) => r.issues.some((i) => i.level === "warning")).length,
    createCount: analysed.filter((r) => r.action === "create").length,
    updateCount: analysed.filter((r) => r.action === "update").length,
    skipCount: analysed.filter((r) => r.action === "skip").length,
    preview: analysed.slice(0, PREVIEW_ROW_LIMIT),
    previewTruncated: analysed.length > PREVIEW_ROW_LIMIT,
    fileIssues,
  };

  return { analysis, rows: analysed };
}

export async function applyImport(supabase: Client, csv: string): Promise<ImportResult> {
  const agencyId = await currentAgencyId(supabase);
  const { rows } = await analyseImport(supabase, csv);
  const existing = await loadExisting(supabase);

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const messages: string[] = [];
  const warnings = rows.filter((r) => r.issues.some((i) => i.level === "warning")).length;
  const errors = rows.filter((r) => r.issues.some((i) => i.level === "error")).length;

  const ensureContact = async (
    table: "tenants" | "landlords",
    index: Map<string, { id: string; name: string; phone: string | null }>,
    name: string,
    phone: string | null,
  ) => {
    const found = index.get(name.trim().toLowerCase());
    if (found) {
      // Never overwrite populated contact data — only fill a blank phone.
      if (!found.phone && phone) {
        await supabase.from(table).update({ phone }).eq("id", found.id);
        found.phone = phone;
      }
      return found.id;
    }
    const { data, error } = await supabase
      .from(table)
      .insert({ agency_id: agencyId, name: name.trim(), phone })
      .select("id, name, phone")
      .single();
    if (error) throw new Error(error.message);
    const row = data as { id: string; name: string; phone: string | null };
    index.set(row.name.trim().toLowerCase(), row);
    return row.id;
  };

  for (const row of rows) {
    if (row.action === "skip") {
      skipped += 1;
      continue;
    }

    try {
      const tenantId = row.tenant_name
        ? await ensureContact("tenants", existing.tenants, row.tenant_name, row.tenant_phone)
        : null;
      const landlordId = row.landlord_name
        ? await ensureContact("landlords", existing.landlords, row.landlord_name, row.landlord_phone)
        : null;

      const matches = existing.propertiesByKey.get(row.key) ?? [];
      if (matches.length === 1) {
        const current = matches[0];
        const patch: Record<string, string> = {};
        if (!current.postcode && row.postcode) patch.postcode = row.postcode;
        if (!current.tenant_id && tenantId) patch.tenant_id = tenantId;
        if (!current.landlord_id && landlordId) patch.landlord_id = landlordId;
        if (Object.keys(patch).length === 0) {
          skipped += 1;
          continue;
        }
        const { error } = await supabase.from("properties").update(patch).eq("id", current.id);
        if (error) throw new Error(error.message);
        Object.assign(current, patch);
        updated += 1;
        continue;
      }

      const { data, error } = await supabase
        .from("properties")
        .insert({
          agency_id: agencyId,
          address: row.address,
          postcode: row.postcode,
          tenant_id: tenantId,
          landlord_id: landlordId,
        })
        .select("id, address, postcode, landlord_id, tenant_id")
        .single();
      if (error) throw new Error(error.message);
      existing.propertiesByKey.set(row.key, [data as ExistingProperty]);
      added += 1;
    } catch (error) {
      skipped += 1;
      messages.push(
        `Row ${row.line}: ${error instanceof Error ? error.message : "could not be imported"}`,
      );
    }
  }

  return { added, updated, skipped, warnings, errors, messages: messages.slice(0, 20) };
}

export async function buildPropertyExport(supabase: Client) {
  const { data, error } = await supabase
    .from("properties")
    .select("address, postcode, tenant:tenants(name, phone), landlord:landlords(name, phone)")
    .order("address");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{
    address: string;
    postcode: string | null;
    tenant: { name: string; phone: string | null } | null;
    landlord: { name: string; phone: string | null } | null;
  }>).map((p) => [
    p.address,
    p.postcode ?? "",
    p.tenant?.name ?? "",
    p.tenant?.phone ?? "",
    p.landlord?.name ?? "",
    p.landlord?.phone ?? "",
  ]);
}
