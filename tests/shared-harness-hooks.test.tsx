// @vitest-environment jsdom
import * as React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { createTestQueryClient, renderWithQueryClient } from "@mano8/astro-ui-m8/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listBlocksMock = vi.hoisted(() => vi.fn());
const composeTemplateMock = vi.hoisted(() => vi.fn());
const getAdminOverviewMock = vi.hoisted(() => vi.fn());

vi.mock("../src/runtime/api/blocks.js", () => ({
  listBlocks: listBlocksMock,
  createBlock: vi.fn(),
  updateBlock: vi.fn(),
  deleteBlock: vi.fn()
}));

vi.mock("../src/runtime/api/templates.js", () => ({
  listTemplates: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  addTemplateBlock: vi.fn(),
  setTemplateBlockPosition: vi.fn(),
  removeTemplateBlock: vi.fn(),
  composeTemplate: composeTemplateMock,
  getTemplate: vi.fn(),
  getTemplateBySlug: vi.fn(),
  getTemplateBlocks: vi.fn()
}));

vi.mock("../src/runtime/api/admin.js", () => ({
  getAdminOverview: getAdminOverviewMock
}));

import { PromptProvider } from "../src/runtime/react/PromptProvider.js";
import { useComposePrompt } from "../src/runtime/hooks/useComposePrompt.js";
import { usePromptAdmin } from "../src/runtime/hooks/usePromptAdmin.js";
import { usePromptBlocks } from "../src/runtime/hooks/usePromptBlocks.js";
import { promptKeys } from "../src/runtime/queryKeys.js";

function createAdapter(isSuperuser: boolean) {
  return {
    getAccessToken: () => "token",
    getUser: () => ({ is_superuser: isSuperuser }),
    isSuperuser: (user: unknown) =>
      Boolean((user as { is_superuser?: boolean } | null)?.is_superuser)
  };
}

function renderPromptUi(ui: React.ReactElement, isSuperuser = true) {
  const queryClient = createTestQueryClient();
  const rendered = renderWithQueryClient(
    <PromptProvider adapter={createAdapter(isSuperuser)}>{ui}</PromptProvider>,
    { client: queryClient }
  );

  return { ...rendered, queryClient };
}

function PromptBlocksProbe() {
  const { data, loading, refresh } = usePromptBlocks({ page: 2, pageSize: 5 });

  if (loading && !data) {
    return <p>loading</p>;
  }

  return (
    <div>
      <p>count:{data?.count ?? 0}</p>
      <button type="button" onClick={() => void refresh()}>
        refresh
      </button>
    </div>
  );
}

function ComposeProbe() {
  const { compose, composeMutation } = useComposePrompt();

  return (
    <button
      type="button"
      onClick={() =>
        void compose(7, [
          {
            id: 42,
            content: "replacement"
          }
        ])
      }
    >
      {composeMutation.data?.content ?? "compose"}
    </button>
  );
}

function AdminProbe() {
  const { allowed, load } = usePromptAdmin();
  const [message, setMessage] = React.useState("idle");

  return (
    <div>
      <p>{allowed ? "allowed" : "forbidden"}</p>
      <button
        type="button"
        onClick={() => {
          void load()
            .then(() => setMessage("loaded"))
            .catch((error: unknown) => {
              setMessage(error instanceof Error ? error.message : "error");
            });
        }}
      >
        load
      </button>
      <p>{message}</p>
    </div>
  );
}

beforeEach(() => {
  listBlocksMock.mockReset();
  composeTemplateMock.mockReset();
  getAdminOverviewMock.mockReset();
});

describe("shared testing harness adoption", () => {
  it("renders usePromptBlocks with the shared query-client harness and supports refresh", async () => {
    listBlocksMock
      .mockResolvedValueOnce({ data: [], count: 0 })
      .mockResolvedValueOnce({ data: [], count: 4 });

    renderPromptUi(<PromptBlocksProbe />);

    expect(await screen.findByText("count:0")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));

    await screen.findByText("count:4");
    expect(listBlocksMock).toHaveBeenNthCalledWith(1, { page: 2, pageSize: 5 });
    expect(listBlocksMock).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 5 });
  });

  it("stores compose results in the shared query cache", async () => {
    composeTemplateMock.mockResolvedValue({ content: "composed body" });

    const { queryClient } = renderPromptUi(<ComposeProbe />);
    fireEvent.click(screen.getByRole("button", { name: "compose" }));

    await screen.findByText("composed body");
    await waitFor(() => {
      expect(queryClient.getQueryData(promptKeys.compose(7))).toEqual({
        content: "composed body"
      });
    });
    expect(composeTemplateMock).toHaveBeenCalledWith(7, [{ id: 42, content: "replacement" }]);
  });

  it("surfaces the admin guard through the shared harness without touching the backend", async () => {
    const { queryClient } = renderPromptUi(<AdminProbe />, false);

    expect(screen.getByText("forbidden")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "load" }));

    await screen.findByText("You do not have permission to perform this action");
    expect(getAdminOverviewMock).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(promptKeys.adminOverview())?.error).toBeInstanceOf(Error);
  });
});
