#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "src", "cli.ts");
let tsxCli;
try {
  tsxCli = join(dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");
} catch {
  console.error("yorck: missing dependency 'tsx'. Run npm install in the yorck package.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [tsxCli, cli, ...process.argv.slice(2)], { stdio: "inherit" });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 0);
