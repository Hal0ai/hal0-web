/* hal0.dev — /benchmarks. Leaderboard + evals + run drawer.
 * Extends the existing ModelRoster idiom: hardware/context cards up top,
 * capability glyphs, decode-speed buckets (fast ≥60 · mid ≥25 · slow <25),
 * one sortable table with the model column as the anchor. */
const { Icon } = window.Hal0DesignSystem_692ad8;
const BENCH = window.BENCH, MODELS = window.MODELS, bucket = window.bucket;

/* ── capability glyphs — same family as the hal0 icon set ─────── */
const CAP_GLYPH = {
  mtp: <g><path d="M2 4l4 4-4 4" /><path d="M8 4l4 4-4 4" /></g>,
  vision: <g><path d="M1 8s2.5-4 7-4 7 4 7 4-2.5 4-7 4-7-4-7-4z" /><circle cx="8" cy="8" r="1.8" /></g>,
  tools: <path d="M10.5 2a3.5 3.5 0 0 0-3.2 4.9L2 12.2 3.8 14l5.3-5.3A3.5 3.5 0 1 0 10.5 2z" />,
  coding: <g><path d="M5.5 4.5L2 8l3.5 3.5" /><path d="M10.5 4.5L14 8l-3.5 3.5" /></g>,
  reasoning: <g><circle cx="4" cy="4" r="1.6" /><circle cx="12" cy="6" r="1.6" /><circle cx="6" cy="12" r="1.6" /><path d="M5.4 4.9l5.2.6M4.8 5.5l1 5" /></g>,
};
function Cap({ name, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={name}><title>{name}</title>{CAP_GLYPH[name]}</svg>
  );
}
function Caps({ caps }) {
  if (!caps.length) return <span style={{ color: "var(--fg-5)" }}>—</span>;
  return <span className="caps">{caps.map(c => <Cap key={c} name={c} />)}</span>;
}

/* ── decode bucket: meter + number, never colour alone ────────── */
function Decode({ v, sd, showSd = true }) {
  const b = bucket(v), fill = { fast: 3, mid: 2, slow: 1 }[b];
  return (
    <span className={"decode " + b} title={`${b} · ${v} tok/s`}>
      <span className="meter" aria-hidden="true">{[0, 1, 2].map(i => <i key={i} className={i < fill ? "on" : ""} />)}</span>
      <span className="v num">{v.toFixed(1)}</span>
      {showSd && sd != null && <span className="sd num">±{sd}</span>}
      <span className="sr">{b}</span>
    </span>
  );
}

function Spark({ data, w = 62, h = 18 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => [2 + (i / (data.length - 1)) * (w - 4), h - 2 - ((v - min) / (max - min || 1)) * (h - 5)]);
  const dip = data.findIndex((v, i) => i > 0 && v < data[i - 1] * 0.9);
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts.map(p => p.join(",")).join(" ")} fill="none" stroke={dip > -1 ? "var(--warn)" : "var(--fg-4)"} strokeWidth="1.2" />
      {dip > -1 && <circle cx={pts[dip][0]} cy={pts[dip][1]} r="2" fill="var(--warn)" />}
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="1.8" fill="var(--accent)" />
    </svg>
  );
}

function Seg({ options, value, onChange, label }) {
  return (
    <div className="segrow">
      <span className="label">{label}</span>
      <div className="seg">
        {options.map(o => (
          <button key={o} className={o === value ? "on" : ""} onClick={() => onChange(o)}>{o}</button>
        ))}
      </div>
    </div>
  );
}

/* ── run drawer ──────────────────────────────────────────────── */
const ARGV = (r) => `llama-server -m /mnt/ai-models/${r.model}.gguf -ngl 99 -c ${r.depth} -fa 1 \\
  -ctk ${r.kv === "f16" ? "f16" : r.kv + "_0"} -ctv ${r.kv === "f16" ? "f16" : r.kv + "_0"} --parallel 1 \\
  -b ${r.variant === "b1024" ? 1024 : 512} --temp 0.7 --top-p 0.8 --min-p 0.05 \\
  ${r.spec === "draft-mtp" && r.variant !== "mtp-off" ? "--draft-max 4 --draft-min 1 --mtp on \\\n  " : ""}--host 0.0.0.0 --port 8080`;

function Drawer({ run, onClose }) {
  const [copied, setCopied] = React.useState(false);
  if (!run) return null;
  const hi = Math.max(...run.history), lo = Math.min(...run.history);
  const regressed = run.history.some((v, i) => i > 0 && v < run.history[i - 1] * 0.9);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer-run" role="dialog" aria-label="run detail">
        <div className="dr-head">
          <div>
            <span className="eyebrow">run detail</span>
            <div className="mono dr-title">{run.model}</div>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        </div>
        <div className="dr-body">
          <div className="dr-metrics">
            <div><div className="label">decode</div><Decode v={run.dec} sd={run.decSd} /></div>
            <div><div className="label">prefill</div><div className="stat">{run.pf.toFixed(1)} <span className="u">tok/s</span></div></div>
            <div><div className="label">ttft p50 / p95</div><div className="stat">{run.ttftP50} <span className="u">/ {run.ttftP95} ms</span></div></div>
            <div><div className="label">accept rate</div><div className="stat">{run.acc ? run.acc + " %" : "—"}</div></div>
          </div>

          <section>
            <h4 className="label">identity</h4>
            <dl className="kv">
              <dt>engine</dt><dd>llama-server</dd>
              <dt>lane</dt><dd><span className={"chip " + laneChip(run.lane)}>{run.lane}</span></dd>
              <dt>variant</dt><dd>{run.variant}</dd>
              <dt>workload</dt><dd>tg · depth {run.depth}</dd>
              <dt>kv cache</dt><dd>{run.kv}</dd>
              <dt>speculative</dt><dd>{run.spec}</dd>
              <dt>llama.cpp</dt><dd>b9219-1faa48eef</dd>
              <dt>image</dt><dd className="trunc">ghcr.io/hal0ai/amd-strix-halo-toolboxes@sha256:4f1c…9ab2</dd>
              <dt>gguf sha256</dt><dd className="trunc">sha256:7d2e91c4…f80a</dd>
              <dt>reps</dt><dd>{run.reps} · median reported, ±{run.decSd} sd</dd>
            </dl>
          </section>

          <section>
            <div className="dr-sec-head"><h4 className="label">resolved flags</h4>
              <button className="btn ghost sm" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(ARGV(run)); setCopied(true); setTimeout(() => setCopied(false), 1400); }}>
                {copied ? "copied" : "copy"}
              </button>
            </div>
            <pre className="well argv">{ARGV(run)}</pre>
          </section>

          <section>
            <h4 className="label">host · telemetry</h4>
            {run.throttled && (
              <div className="banner warn"><Icon name="warn" size={14} /><span>Throttled during this run — max edge {run.temp} °C. Numbers are a floor, not a ceiling.</span></div>
            )}
            <dl className="kv">
              <dt>gpu</dt><dd>Radeon 8060S · gfx1151</dd>
              <dt>platform</dt><dd>Proxmox LXC · Ubuntu 24.04 · kernel 7.0.6</dd>
              <dt>rocm</dt><dd>7.2.4 · hal0 v0.5.0a1</dd>
              <dt>ram</dt><dd>128 GB unified · exclusive mode on</dd>
              <dt>vram peak</dt><dd className="num">{run.vram} GB</dd>
              <dt>gtt peak</dt><dd className="num">{run.gtt} GB</dd>
              <dt>max edge temp</dt><dd className="num">{run.temp} °C</dd>
              <dt>avg power</dt><dd className="num">{run.watt} W</dd>
            </dl>
          </section>

          <section>
            <div className="dr-sec-head"><h4 className="label">history · decode tok/s</h4>
              <span className="mono dim" style={{ fontSize: 11 }}>{lo.toFixed(1)} – {hi.toFixed(1)} over 6 sweeps</span></div>
            <div className="histbox">
              <Spark data={run.history} w={480} h={72} />
              {regressed && <div className="banner warn" style={{ marginTop: 10 }}><Icon name="warn" size={14} /><span>Regression: −18 % against the previous sweep, recovered on the next build.</span></div>}
            </div>
          </section>

          <section>
            <h4 className="label">provenance</h4>
            <p className="site-sm">Uploaded as <span className="mono">strix-halo june sweep</span> on 2026-06-19 by <span className="mono">@hal0-ci</span>.</p>
            <div className="dr-actions">
              <button className="btn">download profile toml</button>
              <button className="btn ghost">download bundle (4.2 MB)</button>
              <button className="btn ghost">link to this run</button>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
const laneChip = (l) => (l === "rocm" ? "dev-rocm" : l === "vulkan_radv" ? "dev-vulkan" : "dev-cpu");

Object.assign(window, { Cap, Caps, Decode, Spark, Seg, Drawer, laneChip, ARGV });
