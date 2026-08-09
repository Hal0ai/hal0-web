export class UntarError extends Error {}

const BLOCK = 512;

function octal(bytes: Uint8Array): number {
  const s = new TextDecoder().decode(bytes).replace(/\0/g, "").trim();
  if (s === "") return 0;
  const n = parseInt(s, 8);
  if (Number.isNaN(n) || n < 0) throw new UntarError("bad octal field in tar header");
  return n;
}

function headerName(block: Uint8Array): string {
  const name = new TextDecoder().decode(block.subarray(0, 100)).replace(/\0.*$/, "");
  const prefix = new TextDecoder().decode(block.subarray(345, 500)).replace(/\0.*$/, "");
  return prefix ? `${prefix}/${name}` : name;
}

function unsafe(name: string): boolean {
  return (
    name === "" ||
    name.startsWith("/") ||
    name.includes("\\") ||
    name.split("/").some((p) => p === ".." || p === "")
  );
}

async function gunzip(body: ArrayBuffer, maxTotal: number): Promise<Uint8Array> {
  const ds = new DecompressionStream("gzip");
  const stream = new Response(body).body!.pipeThrough(ds);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxTotal) {
      await reader.cancel();
      throw new UntarError("decompressed size exceeds limit");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

export async function untarGz(
  body: ArrayBuffer,
  opts: { maxMembers: number; maxMemberBytes: number; maxTotalBytes: number },
): Promise<Map<string, Uint8Array>> {
  let data: Uint8Array;
  try {
    data = await gunzip(body, opts.maxTotalBytes);
  } catch (e) {
    if (e instanceof UntarError) throw e;
    throw new UntarError("not a valid gzip stream");
  }
  const members = new Map<string, Uint8Array>();
  let pos = 0;
  while (pos + BLOCK <= data.byteLength) {
    const block = data.subarray(pos, pos + BLOCK);
    if (block.every((b) => b === 0)) break; // end-of-archive marker
    const size = octal(block.subarray(124, 136));
    const typeflag = String.fromCharCode(block[156]);
    const name = headerName(block);
    pos += BLOCK;
    const payloadEnd = pos + size;
    if (payloadEnd > data.byteLength) throw new UntarError("truncated tar member");
    // '0' and '\0' are regular files; skip pax/global headers and anything else.
    if (typeflag === "0" || typeflag === "\0") {
      if (unsafe(name)) throw new UntarError(`unsafe member name: ${name}`);
      if (size > opts.maxMemberBytes) throw new UntarError(`member too large: ${name}`);
      if (members.size >= opts.maxMembers) throw new UntarError("too many members");
      members.set(name, data.slice(pos, payloadEnd));
    }
    pos = payloadEnd + ((BLOCK - (size % BLOCK)) % BLOCK); // advance past padding
  }
  if (members.size === 0) throw new UntarError("empty archive");
  return members;
}
