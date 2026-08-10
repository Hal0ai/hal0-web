CREATE TABLE bundles (
    id            TEXT PRIMARY KEY,          -- "sha256:…" content-addressed
    created_at    TEXT,                      -- manifest.created_at
    uploaded_at   TEXT NOT NULL,             -- server clock, ISO
    title         TEXT DEFAULT '',
    notes         TEXT DEFAULT '',
    host_json     TEXT NOT NULL,
    hal0_version  TEXT DEFAULT '',
    status        TEXT NOT NULL CHECK (status IN ('published','pending','rejected','deleted')),
    uploader      TEXT NOT NULL DEFAULT 'admin',
    r2_key        TEXT NOT NULL,
    size_bytes    INTEGER NOT NULL
);
CREATE INDEX idx_bundles_status ON bundles(status);

CREATE TABLE records (
    cell_key       TEXT NOT NULL,
    run_id         TEXT NOT NULL,
    bundle_id      TEXT NOT NULL REFERENCES bundles(id),
    model_id       TEXT, quant TEXT, lane TEXT, kind TEXT, depth INTEGER,
    config_label   TEXT DEFAULT 'default',
    decode_ts_med  REAL, prefill_ts_med REAL, ttft_ms_p50 REAL, ttft_ms_p95 REAL,
    accept_med     REAL, aggregate_ts REAL,
    identity_json  TEXT NOT NULL,
    summary_json   TEXT NOT NULL,
    telemetry_json TEXT DEFAULT '{}',
    host_json      TEXT DEFAULT '{}',
    flag_json      TEXT DEFAULT NULL,        -- plausibility flags; NULL = clean
    measured_at    TEXT,                     -- derived from run_id stamp
    status         TEXT NOT NULL,            -- denormalized copy of bundle status
    seq            INTEGER PRIMARY KEY AUTOINCREMENT,  -- append order, newest-wins tiebreak
    UNIQUE (cell_key, run_id)
);
CREATE INDEX idx_records_model ON records(model_id, lane, kind);
CREATE INDEX idx_records_cell ON records(cell_key);

CREATE VIEW current_cells AS
SELECT r.* FROM records r
JOIN (
    SELECT cell_key, MAX(seq) AS newest
    FROM records WHERE status = 'published'
    GROUP BY cell_key
) w ON r.cell_key = w.cell_key AND r.seq = w.newest;

CREATE TABLE profiles (
    id        TEXT PRIMARY KEY,              -- "<bundle_id>/<name>"
    name      TEXT NOT NULL,
    bundle_id TEXT NOT NULL REFERENCES bundles(id),
    sha256    TEXT NOT NULL,
    toml      TEXT NOT NULL,
    status    TEXT NOT NULL
);

CREATE TABLE evals (
    run_id    TEXT, bundle_id TEXT NOT NULL REFERENCES bundles(id),
    model     TEXT, task TEXT, score REAL,
    detail_json TEXT DEFAULT '{}',
    status    TEXT NOT NULL
);
CREATE INDEX idx_evals_model ON evals(model);
