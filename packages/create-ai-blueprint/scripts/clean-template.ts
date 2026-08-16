import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templateRoot = path.join(__dirname, "..", "template");
const distRoot = path.join(__dirname, "..", "dist");

Promise.all([
  fs.rm(templateRoot, { recursive: true, force: true }),
  fs.rm(distRoot, { recursive: true, force: true })
]).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
