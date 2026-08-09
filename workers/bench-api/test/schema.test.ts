import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const BUNDLE_ID = "sha256:" + "c".repeat(64);

async function insertBundle(id: string) {
  await env.DB.prepare(
    `INSERT INTO bundles (id, uploaded_at, host_json, status, r2_key, size_bytes)
     VALUES (?, ?, ?, 'published', ?, 1)`,
  )
    .bind(id, "2026-08-09T00:00:00Z", "{}", `bundles/${id}.tar.gz`)
    .run();
}

async function insertRecord(cellKey: string, runId: string, bundleId: string, status: string) {
  await env.DB.prepare(
    `INSERT INTO records (cell_key, run_id, bundle_id, identity_json, summary_json, status)
     VALUES (?, ?, ?, '{}', '{}', ?)`,
  )
    .bind(cellKey, runId, bundleId, status)
    .run();
}

describe("D1 schema", () => {
  it("current_cells returns only the newest-seq published row per cell_key", async () => {
    await insertBundle(BUNDLE_ID);

    const cellKey = "sha256:" + "d".repeat(64);
    await insertRecord(cellKey, "run-1", BUNDLE_ID, "published");
    await insertRecord(cellKey, "run-2", BUNDLE_ID, "published");

    const { results } = await env.DB.prepare(
      "SELECT run_id, seq FROM current_cells WHERE cell_key = ?",
    )
      .bind(cellKey)
      .all<{ run_id: string; seq: number }>();

    expect(results).toHaveLength(1);
    expect(results[0].run_id).toBe("run-2");
  });

  it("current_cells ignores non-published rows even if they have a higher seq", async () => {
    await insertBundle("sha256:" + "e".repeat(64));

    const cellKey = "sha256:" + "f".repeat(64);
    await insertRecord(cellKey, "run-a", "sha256:" + "e".repeat(64), "published");
    await insertRecord(cellKey, "run-b", "sha256:" + "e".repeat(64), "pending");

    const { results } = await env.DB.prepare(
      "SELECT run_id FROM current_cells WHERE cell_key = ?",
    )
      .bind(cellKey)
      .all<{ run_id: string }>();

    expect(results).toHaveLength(1);
    expect(results[0].run_id).toBe("run-a");
  });

  it("rejects an invalid bundles.status via the CHECK constraint", async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO bundles (id, uploaded_at, host_json, status, r2_key, size_bytes)
         VALUES (?, ?, ?, 'bogus', ?, 1)`,
      )
        .bind("sha256:" + "9".repeat(64), "2026-08-09T00:00:00Z", "{}", "bundles/bogus.tar.gz")
        .run(),
    ).rejects.toThrow();
  });
});
