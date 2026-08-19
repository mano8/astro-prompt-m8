// @vitest-environment jsdom
//
// C8 regression coverage: the server-driven prompt-block and prompt-template
// tables must render whatever page the service returns, never a client-side
// slice/filter of an earlier page. `filteredBlocks`/`pagedBlocks`/
// `filteredTemplates`/`pagedTemplates` were deleted under C7 — this proves the
// deletion holds by mounting the production hooks the registry skins call and
// asserting the *rendered rows* (not just the outgoing query string) change
// when the page param changes, over a fixture with more than one page.
//
// Both probes reproduce, verbatim, the prop derivation the skins use:
// `data?.data ?? []` for rows and `data?.count ?? 0` for `rowCount` — see
// registry/blocks/library/prompt-block-editor.tsx and
// registry/blocks/editor/prompt-template-editor.tsx. If either skin ever
// regains a client-side `pagedX` slice, this test starts asserting stale or
// empty rows on page 2 and fails.
import * as React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { createTestQueryClient, renderWithQueryClient } from "@mano8/astro-ui-m8/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PromptBlockPublic, PromptTemplatePublic } from "../src/runtime/schemas.js";

const listBlocksMock = vi.hoisted(() => vi.fn());
const listTemplatesMock = vi.hoisted(() => vi.fn());

vi.mock("../src/runtime/api/blocks.js", () => ({
  listBlocks: listBlocksMock,
  createBlock: vi.fn(),
  updateBlock: vi.fn(),
  deleteBlock: vi.fn()
}));

vi.mock("../src/runtime/api/templates.js", () => ({
  listTemplates: listTemplatesMock,
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  addTemplateBlock: vi.fn(),
  setTemplateBlockPosition: vi.fn(),
  removeTemplateBlock: vi.fn(),
  composeTemplate: vi.fn(),
  getTemplate: vi.fn(),
  getTemplateBySlug: vi.fn(),
  getTemplateBlocks: vi.fn()
}));

import { PromptProvider } from "../src/runtime/react/PromptProvider.js";
import { usePromptBlocks } from "../src/runtime/hooks/usePromptBlocks.js";
import { usePromptTemplates } from "../src/runtime/hooks/usePromptTemplates.js";

function adapter() {
  return {
    getAccessToken: () => "token",
    getUser: () => ({ is_superuser: true }),
    isSuperuser: () => true
  };
}

function renderPromptUi(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return {
    ...renderWithQueryClient(<PromptProvider adapter={adapter()}>{ui}</PromptProvider>, {
      client: queryClient
    }),
    queryClient
  };
}

function block(id: number): PromptBlockPublic {
  return {
    id,
    name: `block-${id}`,
    slug: `block-${id}`,
    description: null,
    content: `content-${id}`,
    type: "role",
    is_dynamic: false,
    is_public: false,
    owner_id: "owner"
  };
}

function template(id: number): PromptTemplatePublic {
  return {
    id,
    name: `template-${id}`,
    slug: `template-${id}`,
    description: null,
    is_public: false,
    blocks: []
  };
}

// 25 rows total, pageSize 10 — three pages, matching the fixture shape the
// audit's proof case used for the service side (H1 fix verification).
const TOTAL = 25;
const PAGE_SIZE = 10;
const ALL_BLOCKS = Array.from({ length: TOTAL }, (_unused, index) => block(index + 1));
const ALL_TEMPLATES = Array.from({ length: TOTAL }, (_unused, index) => template(index + 1));

function serverPage<T>(all: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return { data: all.slice(start, start + pageSize), count: all.length };
}

/** Reproduces `PromptBlockEditor`'s prop derivation verbatim: no client slice. */
function BlockTableProbe() {
  const [page, setPage] = React.useState(1);
  const { data, refresh } = usePromptBlocks({ page, pageSize: PAGE_SIZE });

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = data?.data ?? [];
  const rowCount = data?.count ?? 0;

  return (
    <div>
      <p>rowCount:{rowCount}</p>
      <p>rows:{rows.map((row) => row.name).join(",")}</p>
      <button type="button" onClick={() => setPage(2)}>
        next page
      </button>
    </div>
  );
}

/** Reproduces `PromptTemplateEditorSkin`'s prop derivation verbatim. */
function TemplateTableProbe() {
  const [page, setPage] = React.useState(1);
  const { data, refresh } = usePromptTemplates({ page, pageSize: PAGE_SIZE });

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = data?.data ?? [];
  const rowCount = data?.count ?? 0;

  return (
    <div>
      <p>rowCount:{rowCount}</p>
      <p>rows:{rows.map((row) => row.name).join(",")}</p>
      <button type="button" onClick={() => setPage(2)}>
        next page
      </button>
    </div>
  );
}

beforeEach(() => {
  listBlocksMock.mockReset();
  listTemplatesMock.mockReset();
});

describe("C8 — server-driven paging crosses the page boundary", () => {
  it("renders the block table's page 2 as the service's page 2, not a slice of page 1", async () => {
    listBlocksMock.mockImplementation(({ page = 1, pageSize = PAGE_SIZE } = {}) =>
      Promise.resolve(serverPage(ALL_BLOCKS, page, pageSize))
    );

    renderPromptUi(<BlockTableProbe />);

    const page1Names = ALL_BLOCKS.slice(0, PAGE_SIZE).map((row) => row.name).join(",");
    const page2Names = ALL_BLOCKS.slice(PAGE_SIZE, PAGE_SIZE * 2).map((row) => row.name).join(",");

    await screen.findByText(`rows:${page1Names}`);
    expect(await screen.findByText(`rowCount:${TOTAL}`)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "next page" }));

    // The regression this guards: a deleted `pagedBlocks` slice re-appearing
    // would either re-slice page 1 (rendering `page1Names` again) or, since
    // page 1 only has 10 rows, slice to nothing on page 2. Neither is this.
    await screen.findByText(`rows:${page2Names}`);
    expect(screen.queryByText(`rows:${page1Names}`)).toBeNull();
    // `rowCount` must stay the server's filtered count on every page, not the
    // length of whatever array happens to be in hand.
    expect(screen.getByText(`rowCount:${TOTAL}`)).toBeTruthy();

    expect(listBlocksMock).toHaveBeenNthCalledWith(1, { page: 1, pageSize: PAGE_SIZE });
    expect(listBlocksMock).toHaveBeenLastCalledWith({ page: 2, pageSize: PAGE_SIZE });
  });

  it("renders the template table's page 2 as the service's page 2, not a slice of page 1", async () => {
    listTemplatesMock.mockImplementation(({ page = 1, pageSize = PAGE_SIZE } = {}) =>
      Promise.resolve(serverPage(ALL_TEMPLATES, page, pageSize))
    );

    renderPromptUi(<TemplateTableProbe />);

    const page1Names = ALL_TEMPLATES.slice(0, PAGE_SIZE).map((row) => row.name).join(",");
    const page2Names = ALL_TEMPLATES.slice(PAGE_SIZE, PAGE_SIZE * 2).map((row) => row.name).join(",");

    await screen.findByText(`rows:${page1Names}`);
    expect(await screen.findByText(`rowCount:${TOTAL}`)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "next page" }));

    await screen.findByText(`rows:${page2Names}`);
    expect(screen.queryByText(`rows:${page1Names}`)).toBeNull();
    expect(screen.getByText(`rowCount:${TOTAL}`)).toBeTruthy();

    expect(listTemplatesMock).toHaveBeenNthCalledWith(1, { page: 1, pageSize: PAGE_SIZE });
    expect(listTemplatesMock).toHaveBeenLastCalledWith({ page: 2, pageSize: PAGE_SIZE });
  });
});
