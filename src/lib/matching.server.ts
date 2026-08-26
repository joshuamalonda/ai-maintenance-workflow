/**
 * Conservative post-insert matching of a maintenance case to a property in the
 * same agency's directory.
 *
 * Strategy:
 *  1. normalised exact address match (existing behaviour, unchanged)
 *  2. if that fails, a multi-signal fuzzy score: postcode (strong),
 *     address similarity (tolerant of small transcription errors) and the
 *     captured tenant/occupant name (supporting signal only)
 *  3. only auto-assigns on a single clearly high-confidence candidate
 *  4. never guesses between plausible candidates; ambiguous cases are left
 *     unassigned for manual confirmation in the dashboard
 *  5. never throws into the intake path (callers ignore failures)
 */

const ABBREVIATIONS: Record<string, string> = {
  rd: "road",
  st: "street",
  str: "street",
  ave: "avenue",
  av: "avenue",
  cl: "close",
  ct: "court",
  cres: "crescent",
  dr: "drive",
  gdns: "gardens",
  gr: "grove",
  ln: "lane",
  pl: "place",
  sq: "square",
  ter: "terrace",
  terr: "terrace",
  pk: "park",
  hse: "house",
  apt: "apartment",
  flt: "flat",
  n: "north",
  s: "south",
  e: "east",
  w: "west",
};

export function normaliseAddress(value: string | null | undefined): string {
  const base = (value ?? "")
    .toLowerCase()
    .replace(/[.,;:'"`()\[\]]/g, " ")
    .replace(/[-/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "";
  return base
    .split(" ")
    .map((word) => ABBREVIATIONS[word] ?? word)
    .join(" ");
}

const UK_POSTCODE = /\b([a-z]{1,2}\d[a-z\d]?)\s?(\d[a-z]{2})\b/i;

export function extractPostcode(value: string | null | undefined): string | null {
  const match = UK_POSTCODE.exec((value ?? "").toLowerCase());
  return match ? `${match[1]}${match[2]}` : null;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** 0..1 similarity based on edit distance. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const max = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / max;
}

/** Strips a trailing postcode so the street part can be compared on its own. */
function addressWithoutPostcode(value: string): string {
  return value.replace(UK_POSTCODE, " ").replace(/\s+/g, " ").trim();
}

function nameSimilarity(a: string | null, b: string | null): number {
  const x = (a ?? "").toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
  const y = (b ?? "").toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
  if (!x || !y) return 0;
  if (x === y) return 1;
  const xs = new Set(x.split(" "));
  const ys = y.split(" ");
  const shared = ys.filter((t) => t.length > 1 && xs.has(t)).length;
  if (shared > 0) return Math.min(1, shared / Math.max(xs.size, ys.length) + 0.2);
  return similarity(x, y) > 0.85 ? 0.7 : 0;
}

export type MatchResult =
  | {
      matched: true;
      method: "exact" | "fuzzy";
      confidence: number;
      propertyId: string;
      tenantId: string | null;
      landlordId: string | null;
    }
  | {
      matched: false;
      reason: "no-address" | "no-candidates" | "ambiguous" | "low-confidence" | "error";
    };

type PropertyRow = {
  id: string;
  address: string | null;
  postcode: string | null;
  tenant_id: string | null;
  landlord_id: string | null;
  tenant?: { name: string | null } | null;
};

const compact = (v: string) => v.replace(/\s+/g, "");

/** Score a candidate 0..1 from postcode, address and occupant-name signals. */
export function scoreCandidate(
  target: { address: string; postcode: string | null; tenantName: string | null },
  property: {
    address: string | null;
    postcode: string | null;
    tenantName: string | null;
  },
): { score: number; postcodeMatch: boolean; addressScore: number; nameScore: number } {
  const propAddress = normaliseAddress(property.address);
  const propPostcode = property.postcode
    ? extractPostcode(property.postcode) ?? compact(normaliseAddress(property.postcode))
    : extractPostcode(propAddress);

  const targetStreet = addressWithoutPostcode(target.address);
  const propStreet = addressWithoutPostcode(propAddress);

  const addressScore = Math.max(
    similarity(targetStreet, propStreet),
    similarity(compact(targetStreet), compact(propStreet)),
  );
  const postcodeMatch = Boolean(
    target.postcode && propPostcode && target.postcode === propPostcode,
  );
  const nameScore = nameSimilarity(target.tenantName, property.tenantName);

  // Weighted blend: postcode strong, address primary, name supporting only.
  // Weights are renormalised over the signals that are actually available, so
  // a missing postcode does not permanently cap the score.
  const postcodeComparable = Boolean(target.postcode && propPostcode);
  const nameComparable = Boolean(target.tenantName && property.tenantName);
  const weight = 0.45 + (postcodeComparable ? 0.4 : 0) + (nameComparable ? 0.15 : 0);
  let score =
    ((postcodeMatch ? 0.4 : 0) + addressScore * 0.45 + nameScore * (nameComparable ? 0.15 : 0)) /
    weight;

  // A confirmed different postcode is a strong signal these are not the same
  // property, whatever the address text looks like.
  if (postcodeComparable && !postcodeMatch) score = Math.min(score, 0.5);

  return { score, postcodeMatch, addressScore, nameScore };
}

const AUTO_ASSIGN_THRESHOLD = 0.78;
const RUNNER_UP_GAP = 0.12;

export async function matchCaseToProperty(input: {
  caseId: string;
  agencyId: string;
  propertyAddress: string | null;
  tenantName?: string | null;
}): Promise<MatchResult> {
  const target = normaliseAddress(input.propertyAddress);
  if (!target) return { matched: false, reason: "no-address" };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("properties")
      .select("id, address, postcode, tenant_id, landlord_id, tenant:tenants(name)")
      .eq("agency_id", input.agencyId);
    if (error || !data) return { matched: false, reason: "error" };

    const properties = data as unknown as PropertyRow[];

    // ---- 1. Existing exact / normalised match (unchanged behaviour) ------
    const targetCompact = compact(target);
    const exact = properties.filter((p) => {
      const address = normaliseAddress(p.address);
      if (!address) return false;
      const postcode = normaliseAddress(p.postcode);
      const keys = [address, postcode ? `${address} ${postcode}` : null].filter(
        Boolean,
      ) as string[];
      return keys.some((k) => k === target || compact(k) === targetCompact);
    });

    if (exact.length === 1) {
      return finalise(supabaseAdmin, input, exact[0]!, "exact", 1);
    }
    if (exact.length > 1) return { matched: false, reason: "ambiguous" };

    // ---- 2. Fuzzy, multi-signal fallback ---------------------------------
    const targetPostcode = extractPostcode(input.propertyAddress ?? "");
    const scored = properties
      .map((p) => ({
        property: p,
        ...scoreCandidate(
          { address: target, postcode: targetPostcode, tenantName: input.tenantName ?? null },
          {
            address: p.address,
            postcode: p.postcode,
            tenantName: p.tenant?.name ?? null,
          },
        ),
      }))
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return { matched: false, reason: "no-candidates" };

    const best = scored[0]!;
    const runnerUp = scored[1];

    // Never auto-assign on the name signal alone: the address must be
    // recognisably close, or the postcode must match exactly.
    const addressPlausible = best.addressScore >= 0.75 || best.postcodeMatch;

    if (
      best.score >= AUTO_ASSIGN_THRESHOLD &&
      addressPlausible &&
      (!runnerUp || best.score - runnerUp.score >= RUNNER_UP_GAP)
    ) {
      console.info(
        `[matching] fuzzy assign case=${input.caseId} property=${best.property.id} ` +
          `score=${best.score.toFixed(2)} address=${best.addressScore.toFixed(2)} ` +
          `postcode=${best.postcodeMatch} name=${best.nameScore.toFixed(2)}`,
      );
      return finalise(supabaseAdmin, input, best.property, "fuzzy", best.score);
    }

    console.info(
      `[matching] no confident match case=${input.caseId} best=${best.score.toFixed(2)} ` +
        `runnerUp=${runnerUp ? runnerUp.score.toFixed(2) : "none"}`,
    );
    if (runnerUp && best.score - runnerUp.score < RUNNER_UP_GAP && best.score >= 0.6) {
      return { matched: false, reason: "ambiguous" };
    }
    return { matched: false, reason: best.score >= 0.6 ? "low-confidence" : "no-candidates" };
  } catch {
    return { matched: false, reason: "error" };
  }
}

async function finalise(
  supabaseAdmin: { from: (t: string) => any },
  input: { caseId: string; agencyId: string },
  property: PropertyRow,
  method: "exact" | "fuzzy",
  confidence: number,
): Promise<MatchResult> {
  const { error: updateError } = await supabaseAdmin
    .from("maintenance_cases")
    .update({ property_id: property.id, tenant_id: property.tenant_id ?? null })
    .eq("id", input.caseId)
    .eq("agency_id", input.agencyId);
  if (updateError) return { matched: false, reason: "error" };

  return {
    matched: true,
    method,
    confidence,
    propertyId: property.id,
    tenantId: property.tenant_id ?? null,
    landlordId: property.landlord_id ?? null,
  };
}
