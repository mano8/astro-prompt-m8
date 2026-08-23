/**
 * Registry drift gate.
 *
 * Regenerates the shadcn registry and fails when the working tree moves, so a
 * generated `registry/r/**` can never disagree with the sources it is built
 * from. `git status --porcelain` rather than `git diff` on purpose: a brand new
 * generated item is untracked, and a diff would not see it.
 */
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const WATCHED = ["registry.json", "registry/r"];

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", shell: false });
  if (result.error) throw result.error;
  return result;
}

const build = spawnSync(process.execPath, [join(ROOT, "scripts", "build-registry.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
  shell: false,
});
if (build.status !== 0) {
  console.error("[verify-registry-drift] the registry build failed");
  process.exit(build.status ?? 1);
}

const status = run("git", ["status", "--porcelain", "--", ...WATCHED]);
if (status.status !== 0) {
  console.error("[verify-registry-drift] git status failed:");
  console.error(status.stderr.trim());
  process.exit(status.status ?? 1);
}

const drifted = status.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
if (drifted.length > 0) {
  console.error("[verify-registry-drift] the generated registry is out of date; run `npm run build:registry` and commit:");
  for (const entry of drifted) console.error(`  ${entry}`);
  const diff = run("git", ["--no-pager", "diff", "--", ...WATCHED]);
  if (diff.stdout.trim()) console.error(diff.stdout);
  process.exit(1);
}

console.log(`[verify-registry-drift] ${WATCHED.join(", ")} match their sources`);
