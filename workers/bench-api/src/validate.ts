export class ValidationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join("; "));
  }
}

export interface Manifest {
  bundle_schema: number;
  bundle_id: string;
  created_at?: string;
  hal0_version?: string;
  title?: string;
  notes?: string;
  host?: Record<string, unknown>;
  records?: unknown[];
  profiles?: { name: string; sha256: string }[];
  artifacts?: boolean;
  files?: Record<string, string>;
}

export interface ParsedRecord {
  cellKey: string;
  runId: string;
  modelId: string | null;
  quant: string | null;
  lane: string | null;
  kind: string | null;
  depth: number | null;
  configLabel: string;
  decodeTsMed: number | null;
  prefillTsMed: number | null;
  ttftMsP50: number | null;
  ttftMsP95: number | null;
  acceptMed: number | null;
  aggregateTs: number | null;
  identityJson: string;
  summaryJson: string;
  telemetryJson: string;
  hostJson: string;
  flagJson: string | null;
  measuredAt: string;
}

export interface EvalRow {
  runId: string | null;
  model: string | null;
  task: string | null;
  score: number;
  detailJson: string;
}

export interface ValidBundle {
  bundleId: string;
  manifest: Manifest;
  records: ParsedRecord[];
  evals: EvalRow[];
  profiles: { name: string; sha256: string; toml: string }[];
}

const NAME_RE =
  /^(manifest\.json|records\.jsonl|evals\.jsonl|profiles\/[^/]+\.toml|artifacts\/[^/]+\/.+)$/;
const CELL_RE = /^sha256:[0-9a-f]{64}$/;
const HEX_RE = /^[0-9a-f]{64}$/;

async function sha256hex(data: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Canonical JSON over a {string: string} map — mirrors Python's
// json.dumps(sort_keys=True, separators=(",",":")). Strings only, so the
// float-formatting divergence that blocks cell_key recompute cannot occur.
function canonicalFilesMap(files: Record<string, string>): string {
  const sorted = Object.keys(files).sort();
  return "{" + sorted.map((k) => `${JSON.stringify(k)}:${JSON.stringify(files[k])}`).join(",") + "}";
}

const PLAUSIBLE = {
  decode_ts_med: [0.05, 5000],
  prefill_ts_med: [0.5, 100000],
  ttft_ms_p50: [0.1, 600000],
} as const;

function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** Number if present & finite, throws label into errs if present but invalid, else null. */
function optionalMetric(
  value: unknown,
  label: string,
  errs: string[],
  requirePositive: boolean,
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || (requirePositive && value <= 0)) {
    errs.push(`${label}: non-finite or non-positive`);
    return null;
  }
  return value;
}

function measuredAtFromRunId(runId: string): string {
  const idx = runId.indexOf("Z-");
  return idx >= 0 ? runId.slice(0, idx + 1) : runId;
}

function parseRecordLine(line: string, idx: number, errs: string[]): ParsedRecord | null {
  let rec: Record<string, unknown>;
  try {
    rec = JSON.parse(line);
  } catch {
    errs.push(`records.jsonl line ${idx}: not valid JSON`);
    return null;
  }

  if (rec.outcome !== "ok") {
    errs.push(`records.jsonl line ${idx}: non-ok record (outcome=${String(rec.outcome)})`);
    return null;
  }

  const cellKey = rec.cell_key;
  if (typeof cellKey !== "string" || !CELL_RE.test(cellKey)) {
    errs.push(`records.jsonl line ${idx}: bad cell_key format`);
    return null;
  }

  const runId = rec.run_id;
  if (typeof runId !== "string" || runId === "") {
    errs.push(`records.jsonl line ${idx}: missing run_id`);
    return null;
  }

  const identity = (rec.identity ?? {}) as Record<string, unknown>;
  const model = (identity.model ?? {}) as Record<string, unknown>;
  const workload = (identity.workload ?? {}) as Record<string, unknown>;
  const summary = (rec.summary ?? {}) as Record<string, unknown>;
  const host = (rec.host ?? {}) as Record<string, unknown>;
  const telemetry = (rec.telemetry ?? {}) as Record<string, unknown>;

  const lineErrs: string[] = [];
  const decodeTsMed = optionalMetric(summary.decode_ts_med, "decode_ts_med", lineErrs, true);
  const prefillTsMed = optionalMetric(summary.prefill_ts_med, "prefill_ts_med", lineErrs, true);
  const ttftMsP50 = optionalMetric(summary.ttft_ms_p50, "ttft_ms_p50", lineErrs, true);
  const ttftMsP95 = optionalMetric(summary.ttft_ms_p95, "ttft_ms_p95", lineErrs, true);
  const acceptMed = optionalMetric(summary.accept_med, "accept_med", lineErrs, false);
  const aggregateTs = optionalMetric(summary.aggregate_ts, "aggregate_ts", lineErrs, false);

  if (lineErrs.length) {
    errs.push(...lineErrs.map((e) => `records.jsonl line ${idx}: ${e}`));
    return null;
  }

  if (
    decodeTsMed === null &&
    prefillTsMed === null &&
    ttftMsP50 === null &&
    ttftMsP95 === null
  ) {
    errs.push(`records.jsonl line ${idx}: no summary metrics present`);
    return null;
  }

  const flags: string[] = [];
  if (decodeTsMed !== null) {
    const [lo, hi] = PLAUSIBLE.decode_ts_med;
    if (decodeTsMed < lo || decodeTsMed > hi) flags.push(`implausible decode_ts_med: ${decodeTsMed}`);
  }
  if (prefillTsMed !== null) {
    const [lo, hi] = PLAUSIBLE.prefill_ts_med;
    if (prefillTsMed < lo || prefillTsMed > hi)
      flags.push(`implausible prefill_ts_med: ${prefillTsMed}`);
  }
  if (ttftMsP50 !== null) {
    const [lo, hi] = PLAUSIBLE.ttft_ms_p50;
    if (ttftMsP50 < lo || ttftMsP50 > hi) flags.push(`implausible ttft_ms_p50: ${ttftMsP50}`);
  }

  const configLabel = typeof rec.config === "string" && rec.config !== "" ? rec.config : "default";

  return {
    cellKey,
    runId,
    modelId: typeof model.id === "string" ? model.id : null,
    quant: typeof model.quant === "string" ? model.quant : null,
    lane: typeof identity.lane === "string" ? identity.lane : null,
    kind: typeof workload.kind === "string" ? workload.kind : null,
    depth: typeof workload.depth === "number" ? workload.depth : null,
    configLabel,
    decodeTsMed,
    prefillTsMed,
    ttftMsP50,
    ttftMsP95,
    acceptMed,
    aggregateTs,
    identityJson: JSON.stringify(identity),
    summaryJson: JSON.stringify(summary),
    telemetryJson: JSON.stringify(telemetry),
    hostJson: JSON.stringify(host),
    flagJson: flags.length ? JSON.stringify(flags) : null,
    measuredAt: measuredAtFromRunId(runId),
  };
}

function parseEvalLine(line: string, idx: number, errs: string[]): EvalRow | null {
  let row: Record<string, unknown>;
  try {
    row = JSON.parse(line);
  } catch {
    errs.push(`evals.jsonl line ${idx}: not valid JSON`);
    return null;
  }
  const score = row.score;
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) {
    errs.push(`evals.jsonl line ${idx}: score not finite or out of [0,1]`);
    return null;
  }
  return {
    runId: typeof row.run_id === "string" ? row.run_id : null,
    model: typeof row.model === "string" ? row.model : null,
    task: typeof row.task === "string" ? row.task : null,
    score,
    detailJson: "{}",
  };
}

export async function validateBundle(members: Map<string, Uint8Array>): Promise<ValidBundle> {
  const errs: string[] = [];
  const manifestRaw = members.get("manifest.json");
  if (!manifestRaw) throw new ValidationError(["missing manifest.json"]);
  let manifest: Manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifestRaw));
  } catch {
    throw new ValidationError(["manifest.json is not valid JSON"]);
  }
  if (manifest.bundle_schema !== 1) errs.push(`unsupported bundle_schema: ${manifest.bundle_schema}`);

  // 1. every member (except manifest) allowlisted, hashed in files{}, hash matches
  for (const [name, data] of members) {
    if (name === "manifest.json") continue;
    if (!NAME_RE.test(name)) {
      errs.push(`unexpected member: ${name}`);
      continue;
    }
    const want = manifest.files?.[name];
    if (!want || !HEX_RE.test(want)) {
      errs.push(`member not in manifest.files: ${name}`);
      continue;
    }
    if ((await sha256hex(data)) !== want) errs.push(`sha256 mismatch: ${name}`);
  }
  for (const name of Object.keys(manifest.files ?? {}))
    if (!members.has(name)) errs.push(`manifest lists missing member: ${name}`);

  // 2. bundle_id recompute (strings-only canonical JSON — fully verifiable)
  const computed =
    "sha256:" + (await sha256hex(new TextEncoder().encode(canonicalFilesMap(manifest.files ?? {}))));
  if (computed !== manifest.bundle_id) errs.push("bundle_id mismatch (content-address forged or stale)");
  if (errs.length) throw new ValidationError(errs);

  // 3. records: parse each line; ok-only; cell_key format; finite positive metrics;
  //    plausibility -> flagJson.
  const recordsRaw = members.get("records.jsonl");
  if (!recordsRaw) errs.push("missing records.jsonl");
  const records: ParsedRecord[] = [];
  if (recordsRaw) {
    const text = new TextDecoder().decode(recordsRaw);
    const lines = text.split("\n").filter((l) => l.trim() !== "");
    for (let i = 0; i < lines.length; i++) {
      const rec = parseRecordLine(lines[i], i, errs);
      if (rec) records.push(rec);
    }
  }

  // 4. evals: parse lines {run_id, model, task, score in [0,1]}.
  const evalsRaw = members.get("evals.jsonl");
  const evals: EvalRow[] = [];
  if (evalsRaw) {
    const text = new TextDecoder().decode(evalsRaw);
    const lines = text.split("\n").filter((l) => l.trim() !== "");
    for (let i = 0; i < lines.length; i++) {
      const row = parseEvalLine(lines[i], i, errs);
      if (row) evals.push(row);
    }
  }

  // 5. profiles: decode TOML text (stored verbatim; non-empty UTF-8 check),
  //    hash matches manifest.profiles.
  const profiles: { name: string; sha256: string; toml: string }[] = [];
  for (const p of manifest.profiles ?? []) {
    const data = members.get(`profiles/${p.name}`);
    if (!data) {
      errs.push(`missing profile member: profiles/${p.name}`);
      continue;
    }
    let toml: string;
    try {
      toml = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(data);
    } catch {
      errs.push(`profile not valid UTF-8: ${p.name}`);
      continue;
    }
    if (toml.trim() === "") {
      errs.push(`profile is empty: ${p.name}`);
      continue;
    }
    const hash = await sha256hex(data);
    if (hash !== p.sha256) {
      errs.push(`profile sha256 mismatch: ${p.name}`);
      continue;
    }
    profiles.push({ name: p.name, sha256: p.sha256, toml });
  }

  if (errs.length) throw new ValidationError(errs);

  return {
    bundleId: manifest.bundle_id,
    manifest,
    records,
    evals,
    profiles,
  };
}
