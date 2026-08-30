// @vitest-environment jsdom
//
// `A-C2`: the dev-only `/_preview` gallery.
//
// `npm run preview:build` proves the gallery *compiles*. That is exactly the
// kind of green light this plan keeps finding pointed at the wrong thing — the
// shared package's own gallery compiled for months while every `table-page`
// sibling import was unresolved, because nothing ever ran it. So this suite
// mounts the gallery and asserts it renders real rows: the views, hooks, api
// wrappers and Zod schemas are the shipped ones, and only `fetch` is replaced.
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { installServiceStub } from "../fixtures/preview/src/service-stub.js";
import { PreviewApp } from "../fixtures/preview/src/preview-app.js";

let restoreFetch: typeof globalThis.fetch;

beforeEach(() => {
  restoreFetch = installServiceStub();
});

afterEach(() => {
  cleanup();
  globalThis.fetch = restoreFetch;
});

describe("preview gallery", () => {
  it("renders the block library island against the stub service", async () => {
    render(<PreviewApp />);

    // Rows only appear if the whole path worked: the view mounted, the hook
    // ran, the api wrapper built a request, the stub answered it, and the Zod
    // schema accepted the answer. A shape the schema rejects fails here.
    await waitFor(
      () => {
        expect(screen.getByText("role block 1")).toBeTruthy();
      },
      { timeout: 4000 }
    );
  });

  it("switches to another island root without losing the stub", async () => {
    render(<PreviewApp />);

    await waitFor(() => expect(screen.getByText("role block 1")).toBeTruthy(), {
      timeout: 4000
    });

    fireEvent.click(screen.getByText("Template editor"));

    await waitFor(() => expect(screen.getByText("Template 1")).toBeTruthy(), {
      timeout: 4000
    });
  });

  it("catches a throw in the boundary panel rather than blanking the gallery", async () => {
    render(<PreviewApp />);

    fireEvent.click(screen.getByText("Error boundary"));
    expect(screen.getByText("Break the probe")).toBeTruthy();

    fireEvent.click(screen.getByText("Break the probe"));

    await waitFor(() => {
      expect(document.querySelector('[data-prompt-error-boundary="fallback"]')).not.toBeNull();
    });
    // The gallery shell itself survives, which is the property the boundary
    // exists to give an island's host page.
    expect(screen.getByText("astro-prompt-m8 /_preview")).toBeTruthy();
  });
});

describe("gallery service stub", () => {
  it("answers the declared list vocabulary rather than returning a fixed page", async () => {
    const read = async (query: string) => {
      const response = await fetch(`/prompt-api/prompt-block/?${query}`);
      return (await response.json()) as { data: { name: string }[]; count: number };
    };

    const all = await read("skip=0&limit=10");
    expect(all.count).toBe(137);
    expect(all.data).toHaveLength(10);

    // `count` is the filtered count, the behaviour change `C2` made and the
    // reason a paginator over it can be trusted.
    const filtered = await read("f=role&skip=0&limit=10");
    expect(filtered.count).toBeLessThan(all.count);
    expect(filtered.data.every((row) => row.name.startsWith("role"))).toBe(true);

    // A blank parameter means absent, not "match the empty string" — an unset
    // table control sends `q=` rather than omitting it.
    const blank = await read("q=&sort=&f=&skip=0&limit=10");
    expect(blank.count).toBe(all.count);

    const searched = await read("q=block 12&skip=0&limit=50");
    expect(searched.count).toBeGreaterThan(0);
    expect(searched.count).toBeLessThan(all.count);

    const descending = await read("sort=name&order=desc&skip=0&limit=1");
    const ascending = await read("sort=name&order=asc&skip=0&limit=1");
    expect(descending.data[0]?.name).not.toBe(ascending.data[0]?.name);

    // Paging returns the service's page 2, not a re-slice of page 1 — the
    // property `C8` pinned on the real client.
    const pageOne = await read("skip=0&limit=5");
    const pageTwo = await read("skip=5&limit=5");
    expect(pageTwo.data[0]?.name).not.toBe(pageOne.data[0]?.name);
  });

  it("404s an unstubbed path instead of hanging", async () => {
    const response = await fetch("/prompt-api/not-a-real-route/");
    expect(response.status).toBe(404);
  });

  it("answers /export/ with the whole filtered set and no skip/limit (A-C8)", async () => {
    const read = async (path: string, query: string) => {
      const response = await fetch(`/prompt-api${path}?${query}`);
      return (await response.json()) as {
        data: { name: string }[];
        count: number;
        truncated: boolean;
      };
    };

    const list = await read("/prompt-block/", "f=role&skip=0&limit=10");
    const exported = await read("/prompt-block/export/", "f=role");

    // The list route pages; the export route doesn't — same filtered count,
    // but every matching row rather than one page of them.
    expect(exported.count).toBe(list.count);
    expect(exported.data).toHaveLength(list.count);
    expect(exported.data.every((row) => row.name.startsWith("role"))).toBe(true);
    expect(exported.truncated).toBe(false);

    const templatesExported = await read("/prompt-template/export/", "");
    expect(templatesExported.truncated).toBe(false);
    expect(templatesExported.data.length).toBe(templatesExported.count);
  });
});
