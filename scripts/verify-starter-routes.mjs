import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = join(root, "fixtures", "starlight-starter");
const scopeDir = join(fixture, "node_modules", "@mano8");
const packageLink = join(scopeDir, "astro-prompt-m8");
const astroBin = join(root, "node_modules", "astro", "bin", "astro.mjs");

mkdirSync(scopeDir, { recursive: true });
if (existsSync(packageLink)) {
  rmSync(packageLink, { force: true, recursive: true });
}
symlinkSync(root, packageLink, "junction");

try {
  const result = spawnSync(process.execPath, [astroBin, "build", "--root", fixture], {
    cwd: root,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
} finally {
  rmSync(packageLink, { force: true, recursive: true });
}
