import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const destination = join(projectRoot, "public", "vendor", "c2pa");

const assets = [
  ["@contentauth/c2pa-web/resources/c2pa.wasm", "c2pa_bg.wasm"],
  ["@contentauth/c2pa-web/c2pa_worker", "c2pa_worker.js"],
];

await mkdir(destination, { recursive: true });

for (const [specifier, filename] of assets) {
  const source = fileURLToPath(import.meta.resolve(specifier));
  await copyFile(source, join(destination, filename));
}

console.log("Copied version-matched C2PA browser assets to public/vendor/c2pa.");
