// Cloudflare static assets are limited to 25 MiB per file. The ONNX Runtime WASM the
// bundler copies in isn't used (the model worker loads it from jsDelivr), so drop it.
import { readdirSync, rmSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));

for (const f of walk("dist")) {
  const size = statSync(f).size;
  if (size <= 25 * 1024 * 1024) continue;
  const name = basename(f);
  if (!(name.startsWith("ort-wasm") && name.endsWith(".wasm"))) throw new Error(`Unexpected asset over 25 MiB: ${f}`);
  rmSync(f);
  console.log(`Removed ${f} (${(size / 1048576).toFixed(1)} MiB; loaded from jsDelivr instead)`);
}
