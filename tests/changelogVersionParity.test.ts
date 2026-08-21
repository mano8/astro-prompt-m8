// Changelog/version parity — ports prompt-engine-m8's A32 lock
// (`tests/test_changelog_version_parity.py`) to the client, per C22's note
// that the client has no equivalent guard. `H21`: `astro-prompt-m8` shipped
// with no `CHANGELOG.md` at all and the step that would write one sat ordered
// after the publish it should have documented. This locks the fix in place:
// the current `package.json` version must head a non-empty CHANGELOG entry,
// no two entries may claim the same version, and a fold leaves `[Unreleased]`
// genuinely empty rather than merely present.

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

  it("the Unreleased section is empty after a fold", () => {
    const text = readChangelog();
    const matches = [...text.matchAll(ALL_HEADING_RE)];
    const unreleased = matches.find((match) => match[1] === "Unreleased");
    expect(unreleased).toBeDefined();

    const start = unreleased!.index! + unreleased![0].length;
    const later = matches.filter((match) => match.index! > unreleased!.index!);
    const end = later.length > 0 ? later[0].index! : text.length;
    const section = text.slice(start, end);

    expect(section.trim()).toBe("");
  });
});
