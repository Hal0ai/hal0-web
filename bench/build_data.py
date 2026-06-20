#!/usr/bin/env python3
"""Emit the Starlight roster-benchmark data file from roster.log + metadata.

Reads bench/roster.log (the parsed sweep results) plus the curated maps below
and writes a typed TS module to src/data/model-roster.ts, which the
ModelRoster.astro component renders into the docs reference page. Decoupled from
the live bench — re-run after any new sweep:  python3 bench/build_data.py

Single source of truth for the *static* model facts (HF repo, capabilities,
arch) lives here; the *measured* facts (decode/prefill/accept/size) come from
roster.log and win over the seeds.
"""
import ast, re, os, json, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
LOG  = os.path.join(HERE, "roster.log")
OUT  = os.path.join(HERE, "..", "src", "data", "model-roster.ts")

HARDWARE = [
 ("SoC", "AMD Ryzen AI Max+ 395 — Strix Halo (Zen 5, 16C/28T)"),
 ("iGPU", "Radeon 8060S — RDNA 3.5, gfx1151 · Vulkan-capable"),
 ("NPU", "AMD XDNA — amdxdna driver"),
 ("Memory", "128 GB unified LPDDR5X · ~96 GB GPU-addressable (GTT) · UMA"),
 ("Host", "Proxmox LXC · Ubuntu 24.04 · kernel 7.0.6"),
 ("Model store", "/mnt/ai-models · ZFS"),
]
BINARY = [
 ("hal0", "v0.5.0a1 · llama-server provider (OpenAI /v1/*)"),
 ("Container", "ghcr.io/hal0ai/amd-strix-halo-toolboxes:rocm-7.2.4-rocmfp4-server"),
 ("llama.cpp", "build b9219-1faa48eef · rocmfp4 fork (draft-mtp speculative)"),
 ("ROCm", "7.2.4"),
]

HFMAP = {
 'chadrock-35b-ace-saber':'jcbtc/chadrock-35b-ace-saber-rocmfp4-mtp',
 'qwen3.6-35b-a3b-crown-halo-mtp-dynamic':'jcbtc/qwen3.6-35b-a3b-crown-halo-mtp-dynamic',
 'chadrock3.6-27b-pi-agent-rocmfp4-mtp':'jcbtc/chadrock3.6-27b-pi-agent-rocmfp4-mtp',
 'qwopus3-6-27b-v2-mtp-bf16-to-rocmfp4-strix-lean':'',
 'gemma-4-12B-agentic-fable5':'yuxinlu1/gemma-4-12B-agentic-fable5-composer2.5-v2-3.5x-tau2-GGUF',
 'qwen3-coder-next-q4kxl':'unsloth/Qwen3-Coder-Next-GGUF',
 'qwen3-coder-next-reap-40b-a3b-q4kxl':'lovedheart/Qwen3-Coder-Next-REAP-40B-A3B-GGUF',
 'Qwopus3.6-27B-Coder-MTP':'Jackrong/Qwopus3.6-27B-Coder-MTP-GGUF',
 'qwen3.6-35b-a3b-q4kxl':'unsloth/Qwen3.6-35B-A3B-GGUF',
 'qwen3.6-27b':'unsloth/Qwen3.6-27B-GGUF',
 'chadrock3-6-35b-uncensored-mtp-strix-lean':'',
 'qwen3-coder-reap-25b-a3b-q5km':'bartowski/cerebras_Qwen3-Coder-REAP-25B-A3B-GGUF',
 'gemma-4-26b-a4b-it-q4kxl':'unsloth/gemma-4-26B-A4B-it-GGUF',
 'qwen3.6-27b-heretic-q4km':'DavidAU/Qwen3.6-27B-Heretic-Uncensored-FINETUNE-NEO-CODE-Di-IMatrix-MAX-GGUF',
 'chadrock3-6-27b-pi-agent-mtp-rocmfp4-strix-lean':'',
 'hermes-4-14b-q5km':'bartowski/NousResearch_Hermes-4-14B-GGUF',
 'qwen3.5-9b-deepseek-v4-flash-mtp':'Jackrong/Qwen3.5-9B-DeepSeek-V4-Flash-MTP-GGUF',
 'qwopus3-5-9b-coder-mtp-q6-k':'',
 'gemma-4-12b-it':'unsloth/gemma-4-12b-it-GGUF',
 'gemma4-v2-q4-k-m':'',
 'qwen3.5-9b-q4kxl':'unsloth/Qwen3.5-9B-GGUF',
 'qwopus3-5-4b-coder-mtp-q6-k':'',
 'qwen3.5-4b-q4kxl':'unsloth/Qwen3.5-4B-GGUF',
 'qwen3-4b-q4-k-m':'',
 'qwen3-zero-coder-v2-0.8b-f16':'DavidAU/Qwen3-Zero-Coder-Reasoning-V2-0.8B-NEO-EX-GGUF',
 'qwen3.5-0.8b':'unsloth/Qwen3.5-0.8B-GGUF',
}
CAP = {
 'chadrock-35b-ace-saber':{"caps":['chat','vision'],"mtp":True,"tags":['rocmfp4','mtp','strix','vision']},
 'qwen3.6-35b-a3b-crown-halo-mtp-dynamic':{"caps":['chat','vision'],"mtp":True,"tags":['mtp','rocmfp4','strix','vision','moe']},
 'chadrock3.6-27b-pi-agent-rocmfp4-mtp':{"caps":['chat','tool-calling'],"mtp":True,"tags":['rocmfp4','mtp','strix','agent']},
 'qwopus3-6-27b-v2-mtp-bf16-to-rocmfp4-strix-lean':{"caps":['chat'],"mtp":True,"tags":['mtp']},
 'gemma-4-12B-agentic-fable5':{"caps":['chat','tool-calling'],"mtp":False,"tags":['gemma-4','agentic','fable5','tau2']},
 'qwen3-coder-next-q4kxl':{"caps":['chat','coding'],"mtp":False,"tags":['unsloth','qwen3-coder']},
 'qwen3-coder-next-reap-40b-a3b-q4kxl':{"caps":['chat','coding'],"mtp":False,"tags":['lovedheart','qwen3-coder','reap','moe']},
 'Qwopus3.6-27B-Coder-MTP':{"caps":['chat','tool-calling'],"mtp":True,"tags":['user-added']},
 'qwen3.6-35b-a3b-q4kxl':{"caps":['chat'],"mtp":False,"tags":['unsloth','qwen3.6','moe']},
 'qwen3.6-27b':{"caps":['chat'],"mtp":False,"tags":['curated','chat','reasoning','multilingual']},
 'chadrock3-6-35b-uncensored-mtp-strix-lean':{"caps":['chat'],"mtp":True,"tags":['mtp','moe']},
 'qwen3-coder-reap-25b-a3b-q5km':{"caps":['chat','coding'],"mtp":False,"tags":['bartowski','cerebras','qwen3-coder','reap','moe']},
 'gemma-4-26b-a4b-it-q4kxl':{"caps":['chat'],"mtp":False,"tags":['unsloth','gemma-4','moe']},
 'qwen3.6-27b-heretic-q4km':{"caps":['chat','coding','vision'],"mtp":False,"tags":['davidau','qwen3.6','uncensored','vision']},
 'chadrock3-6-27b-pi-agent-mtp-rocmfp4-strix-lean':{"caps":['chat'],"mtp":True,"tags":[]},
 'hermes-4-14b-q5km':{"caps":['chat','tool-calling'],"mtp":False,"tags":['bartowski','hermes','nous','tools']},
 'qwen3.5-9b-deepseek-v4-flash-mtp':{"caps":['chat'],"mtp":True,"tags":['user-added','mtp']},
 'qwopus3-5-9b-coder-mtp-q6-k':{"caps":['chat'],"mtp":True,"tags":['mtp']},
 'gemma-4-12b-it':{"caps":['chat'],"mtp":False,"tags":['user-added']},
 'gemma4-v2-q4-k-m':{"caps":['chat'],"mtp":False,"tags":[]},
 'qwen3.5-9b-q4kxl':{"caps":['chat'],"mtp":False,"tags":['unsloth','qwen3.5','medium']},
 'qwopus3-5-4b-coder-mtp-q6-k':{"caps":['chat'],"mtp":True,"tags":['mtp']},
 'qwen3.5-4b-q4kxl':{"caps":['chat'],"mtp":False,"tags":['unsloth','qwen3.5','small']},
 'qwen3-4b-q4-k-m':{"caps":['chat'],"mtp":False,"tags":[]},
 'qwen3-zero-coder-v2-0.8b-f16':{"caps":['chat','coding'],"mtp":False,"tags":['davidau','coder','tiny','f16']},
 'qwen3.5-0.8b':{"caps":['chat'],"mtp":False,"tags":['chat','tiny','smoke-test']},
}
# Seeds carry the static arch facts (params / KV) that the uniform sweep log
# flattens to "—"/"q4". Seed values fill those two columns; perf always comes
# from the log.
SEED = {
 'chadrock-35b-ace-saber':{"params":"35B-A3B","kv":"f16"},
 'qwen3.6-35b-a3b-crown-halo-mtp-dynamic':{"params":"35B-A3B","kv":"f16"},
 'chadrock3.6-27b-pi-agent-rocmfp4-mtp':{"params":"27B dense","kv":"q8"},
 'qwopus3-6-27b-v2-mtp-bf16-to-rocmfp4-strix-lean':{"params":"27B dense","kv":"q4"},
 'gemma-4-12B-agentic-fable5':{"params":"12B dense","kv":"q4"},
}
ORDER = list(HFMAP.keys())

# Capability-icon keys the component knows how to render.
def cap_keys(mid):
    c = CAP.get(mid, {}); caps = c.get('caps', []); tags = c.get('tags', [])
    out = []
    if c.get('mtp'): out.append('mtp')
    if 'vision' in caps: out.append('vision')
    if 'tool-calling' in caps: out.append('tools')
    if 'coding' in caps: out.append('coding')
    if 'reasoning' in tags: out.append('reasoning')
    return out

def derive_params(mid, seeded):
    """Static arch label: seed first, else infer '<N>B' from the id (+MoE tag)."""
    if seeded and seeded.get('params'):
        return seeded['params']
    m = re.search(r'(\d+\.?\d*)\s*b\b', mid.lower())
    base = f"{m.group(1).upper()}B" if m else "—"
    tags = CAP.get(mid, {}).get('tags', [])
    if base != "—" and ('moe' in tags or re.search(r'a\d+b', mid.lower())):
        base += " MoE"
    return base

def parse_log():
    res = {}; cur = None
    if os.path.exists(LOG):
        for ln in open(LOG):
            m = re.match(r'# benching (\S+)', ln)
            if m: cur = m.group(1); continue
            m = re.match(r'#  -> (\{.*\})', ln)
            if m and cur:
                try: res[cur] = ast.literal_eval(m.group(1))
                except Exception: pass
                cur = None
    return res

def num(v):
    return v if isinstance(v, (int, float)) else None

def main():
    res = parse_log()
    rows = []
    for mid in ORDER:
        r = res.get(mid, {}); seeded = SEED.get(mid, {})
        rows.append({
            "id": mid,
            "hfRepo": HFMAP.get(mid, ""),
            "caps": cap_keys(mid),
            "params": derive_params(mid, seeded),
            "kv": (r.get('kv') if r.get('kv') and r.get('kv') != 'q4' else seeded.get('kv')) or r.get('kv') or "",
            "spec": r.get('spec', ""),
            "gb": num(r.get('gb')),
            "dec": num(r.get('dec')),
            "pf": num(r.get('pf')),
            "acc": num(r.get('acc')),
            "note": r.get('note', "").strip(),
            "measured": bool(res.get(mid)),
        })
    measured = sum(1 for x in rows if x["measured"])
    date = datetime.date.today().isoformat()
    payload = {
        "date": date,
        "measured": measured,
        "total": len(rows),
        "hardware": [{"label": k, "value": v} for k, v in HARDWARE],
        "binary": [{"label": k, "value": v} for k, v in BINARY],
        "rows": rows,
    }
    j = json.dumps  # compact-ish, readable
    body = []
    body.append("// AUTO-GENERATED by bench/build_data.py — do not edit by hand.")
    body.append("// Regenerate after a new sweep:  python3 bench/build_data.py")
    body.append("")
    body.append("export interface HwRow { label: string; value: string }")
    body.append("export interface RosterRow {")
    body.append("  id: string")
    body.append("  hfRepo: string")
    body.append("  caps: string[]")
    body.append("  params: string")
    body.append("  kv: string")
    body.append("  spec: string")
    body.append("  gb: number | null")
    body.append("  dec: number | null")
    body.append("  pf: number | null")
    body.append("  acc: number | null")
    body.append("  note: string")
    body.append("  measured: boolean")
    body.append("}")
    body.append("")
    body.append(f"export const ROSTER_DATE = {j(date)}")
    body.append(f"export const ROSTER_MEASURED = {measured}")
    body.append(f"export const ROSTER_TOTAL = {len(rows)}")
    body.append("")
    body.append("export const HARDWARE: HwRow[] = " + j(payload["hardware"], indent=2))
    body.append("")
    body.append("export const BINARY: HwRow[] = " + j(payload["binary"], indent=2))
    body.append("")
    body.append("export const ROSTER: RosterRow[] = " + j(rows, indent=2))
    body.append("")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        f.write("\n".join(body))
    print(f"wrote {os.path.relpath(OUT, HERE)} — {measured}/{len(rows)} measured")

if __name__ == "__main__":
    main()
