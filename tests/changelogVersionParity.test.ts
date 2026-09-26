// Changelog/version parity — ports prompt-engine-m8's A32 lock
// (`tests/test_changelog_version_parity.py`) to the client, per C22's note
// that the client has no equivalent guard. `H21`: `astro-prompt-m8` shipped
// with no `CHANGELOG.md` at all and the step that would write one sat ordered
// after the publish it should have documented. This locks the fix in place:
// the current `package.json` version must head a non-empty CHANGELOG entry,
// no two entries may claim the same version, and a fold strands nothing under
// `[Unreleased]` that a released section already carries.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHANGELOG_PATH = new URL("../CHANGELOG.md", import.meta.url);
const PACKAGE_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as {
    version: string;
  }
).version;

const HEADING_RE = /^## \[(\d+\.\d+\.\d+)\]/gm;
const ALL_HEADING_RE = /^## \[([^\]]+)\].*$/gm;

function readChangelog(): string {
  return readFileSync(CHANGELOG_PATH, "utf-8");
}

function headings(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[1]);
}

describe("changelog/version parity (C22, ports prompt-engine-m8's A32 lock)", () => {
  it("CHANGELOG.md exists at the repo root", () => {
    expect(() => readChangelog()).not.toThrow();
    void REPO_ROOT;
  });

  it("the current package.json version heads a CHANGELOG entry", () => {
    const versions = headings(readChangelog(), HEADING_RE);
    expect(versions).toContain(PACKAGE_VERSION);
  });

  it("the current version's section carries content beyond bare sub-headings", () => {
    const text = readChangelog();
    const matches = [...text.matchAll(ALL_HEADING_RE)];
    const current = matches.find((match) => match[1] === PACKAGE_VERSION);
    expect(current).toBeDefined();

    const start = current!.index! + current![0].length;
    const later = matches.filter((match) => match.index! > current!.index!);
    const end = later.length > 0 ? later[0].index! : text.length;
    const section = text.slice(start, end);

    const contentLines = section
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("###"));

    expect(contentLines.length).toBeGreaterThan(0);
  });

  it("no two entries claim the same version", () => {
    const versions = headings(readChangelog(), HEADING_RE);
    const duplicates = versions.filter((version, index) => versions.indexOf(version) !== index);
    expect(duplicates).toEqual([]);
  });

  // The A32 original asserts an empty `[Unreleased]` only as a post-fold
  // snapshot, and says so: "Not a general rule (mid-wave `[Unreleased]`
  // content is normal)". Ported as a standing assertion, it made every change
  // that ships no release undocumentable (`B34-npm-lock-integrity-guard`
  // found it). What a fold must never do is strand content: leave a bullet
  // under `[Unreleased]` that a released section already carries. That is
  // checked on every commit, and new work may sit there until the next fold.
  it("the Unreleased section heads the file and strands nothing a fold released", () => {
    const text = readChangelog();
    const matches = [...text.matchAll(ALL_HEADING_RE)];
    expect(matches[0]?.[1]).toBe("Unreleased");

    const unreleased = matches[0];
    const start = unreleased.index! + unreleased[0].length;
    const end = matches.length > 1 ? matches[1].index! : text.length;
    const bullets = (section: string) =>
      section
        .split("\n")
        .filter((line) => line.startsWith("- "))
        .map((line) => line.trim());

    const pending = bullets(text.slice(start, end));
    const released = new Set(bullets(text.slice(end)));
    expect(pending.filter((line) => released.has(line))).toEqual([]);
  });
});
