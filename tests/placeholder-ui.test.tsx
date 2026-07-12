// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const usePromptBlocksMock = vi.hoisted(() => vi.fn());
const usePromptTemplatesMock = vi.hoisted(() => vi.fn());
const usePromptTemplateMock = vi.hoisted(() => vi.fn());
const usePromptTemplateBlocksMock = vi.hoisted(() => vi.fn());
const useComposePromptMock = vi.hoisted(() => vi.fn());
const usePromptTransferMock = vi.hoisted(() => vi.fn());

vi.mock("../src/runtime/hooks/usePromptTransfer.js", () => ({
  usePromptTransfer: usePromptTransferMock
}));
vi.mock("../src/runtime/hooks/usePromptBlocks.js", () => ({
  usePromptBlocks: usePromptBlocksMock
}));
vi.mock("../src/runtime/hooks/usePromptTemplates.js", () => ({
  usePromptTemplates: usePromptTemplatesMock
}));
vi.mock("../src/runtime/hooks/usePromptTemplate.js", () => ({
  usePromptTemplate: usePromptTemplateMock,
  usePromptTemplateBlocks: usePromptTemplateBlocksMock
}));
vi.mock("../src/runtime/hooks/useComposePrompt.js", () => ({
  useComposePrompt: useComposePromptMock
}));

import { PromptBlockLibrary } from "../src/runtime/react/PromptBlockLibrary.js";
import { PromptComposer } from "../src/runtime/react/PromptComposer.js";
import { PromptTemplateEditor } from "../src/runtime/react/PromptTemplateEditor.js";

const clipboardWriteTextMock = vi.hoisted(() => vi.fn<(text: string) => Promise<void>>());

function render(element: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(<>{element}</>);
  });
  return {
    container,
    unmount: () => act(() => root.unmount())
  };
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function clickAsync(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function input(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
  usePromptBlocksMock.mockReset();
  usePromptTemplatesMock.mockReset();
  usePromptTemplateMock.mockReset();
  usePromptTemplateBlocksMock.mockReset();
  useComposePromptMock.mockReset();
  usePromptTransferMock.mockReset();
  usePromptTransferMock.mockReturnValue({
    exportBlockMutation: { isPending: false, mutateAsync: vi.fn() },
    exportTemplateMutation: { isPending: false, mutateAsync: vi.fn() },
    importMutation: { isPending: false, mutateAsync: vi.fn() }
  });
  clipboardWriteTextMock.mockReset();
  clipboardWriteTextMock.mockResolvedValue(undefined);
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: clipboardWriteTextMock
    }
  });
});

describe("dynamic placeholder runtime UI", () => {
  it("inserts the placeholder in a dynamic block draft", () => {
    usePromptBlocksMock.mockReturnValue({
      data: { data: [], count: 0 },
      loading: false,
      error: null,
      refresh: vi.fn(),
      createMutation: { isPending: false, mutateAsync: vi.fn() },
      updateMutation: { isPending: false, mutateAsync: vi.fn() },
      deleteMutation: { isPending: false, mutateAsync: vi.fn() }
    });

    const view = render(<PromptBlockLibrary />);
    click(Array.from(view.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("New block")
    ) as HTMLButtonElement);
    const textarea = view.container.querySelector("textarea") as HTMLTextAreaElement;
    input(textarea, "Use this source:\n");
    click(view.container.querySelector('input[type="checkbox"]') as HTMLInputElement);
    click(Array.from(view.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Insert placeholder")
    ) as HTMLButtonElement);

    expect(textarea.value).toBe("Use this source:\n{{dynamic_content}}");
    view.unmount();
  });

  it("requires replacement values and sends the unchanged compose payload", () => {
    const compose = vi.fn();
    usePromptTemplatesMock.mockReturnValue({
      data: {
        data: [{ id: 7, name: "Template", slug: "template", description: null, is_public: false, blocks: [] }],
        count: 1
      },
      loading: false,
      error: null
    });
    usePromptTemplateMock.mockReturnValue({
      data: { id: 7, name: "Template", slug: "template", description: null, is_public: false, blocks: [] }
    });
    usePromptTemplateBlocksMock.mockReturnValue({
      blocks: [
        {
          id: 1,
          block_id: 42,
          template_id: 7,
          name: "Source",
          slug: "source",
          description: null,
          content: "Use this source:\n{{dynamic_content}}",
          type: "context",
          is_dynamic: true,
          is_public: false,
          position: 1
        }
      ]
    });
    useComposePromptMock.mockReturnValue({
      compose,
      composeMutation: { isPending: false, error: null, data: null }
    });

    const view = render(<PromptComposer templateId={7} />);
    click(Array.from(view.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Compose")
    ) as HTMLButtonElement);

    expect(view.container.textContent).toContain("Enter every dynamic replacement value.");
    expect(compose).not.toHaveBeenCalled();

    input(view.container.querySelector("textarea") as HTMLTextAreaElement, "replacement");
    click(Array.from(view.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Compose")
    ) as HTMLButtonElement);

    expect(compose).toHaveBeenCalledWith(7, [{ id: 42, content: "replacement" }]);
    view.unmount();
  });

  it("copies the composed prompt from the compose page", async () => {
    usePromptTemplatesMock.mockReturnValue({
      data: {
        data: [{ id: 7, name: "Template", slug: "template", description: null, is_public: false, blocks: [] }],
        count: 1
      },
      loading: false,
      error: null
    });
    usePromptTemplateMock.mockReturnValue({
      data: { id: 7, name: "Template", slug: "template", description: null, is_public: false, blocks: [] }
    });
    usePromptTemplateBlocksMock.mockReturnValue({ blocks: [] });
    useComposePromptMock.mockReturnValue({
      compose: vi.fn(),
      composeMutation: {
        isPending: false,
        error: null,
        data: { content: "composed prompt body" }
      }
    });

    const view = render(<PromptComposer templateId={7} />);
    input(view.container.querySelector("textarea") as HTMLTextAreaElement, "edited prompt body");
    await clickAsync(Array.from(view.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Copy")
    ) as HTMLButtonElement);

    expect(clipboardWriteTextMock).toHaveBeenCalledWith("edited prompt body");
    expect(view.container.textContent).toContain("Copied");
    view.unmount();
  });

  it("clears stale template compose output, preserves newlines, and copies edited output", async () => {
    const compose = vi.fn().mockResolvedValue({ content: "stale\n\nservice\n\ncontent" });
    const template = {
      id: 7,
      name: "Template",
      slug: "template",
      description: null,
      is_public: false,
      blocks: [
        {
          id: 2,
          block_id: 41,
          template_id: 7,
          name: "Instruction",
          slug: "instruction",
          description: null,
          content: "Static instruction\nKeep spacing\n",
          type: "instruction",
          is_dynamic: false,
          is_public: false,
          position: 0
        },
        {
          id: 1,
          block_id: 42,
          template_id: 7,
          name: "Source",
          slug: "source",
          description: null,
          content: "Use this source:\n{{dynamic_content}}\nEnd source",
          type: "context",
          is_dynamic: true,
          is_public: false,
          position: 1
        }
      ]
    };
    usePromptTemplatesMock.mockReturnValue({
      data: { data: [template], count: 1 },
      loading: false,
      error: null,
      refresh: vi.fn(),
      createMutation: { isPending: false, mutateAsync: vi.fn() },
      updateMutation: { isPending: false, mutateAsync: vi.fn() },
      deleteMutation: { isPending: false, mutateAsync: vi.fn() },
      setPositionMutation: { isPending: false, mutate: vi.fn() },
      addBlockMutation: { isPending: false, mutate: vi.fn() },
      removeBlockMutation: { isPending: false, mutate: vi.fn() }
    });
    usePromptBlocksMock.mockReturnValue({
      data: { data: [], count: 0 },
      loading: false,
      error: null,
      refresh: vi.fn()
    });
    useComposePromptMock.mockReturnValue({
      compose,
      composeMutation: {
        isPending: false,
        error: null,
        data: { content: "stale prompt from previous open" }
      }
    });

    const view = render(<PromptTemplateEditor />);
    click(Array.from(view.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Edit")
    ) as HTMLButtonElement);
    click(Array.from(view.container.querySelectorAll("button")).find((button) =>
      button.textContent === "Compose"
    ) as HTMLButtonElement);
    expect(view.container.textContent).not.toContain("stale prompt from previous open");

    const dynamicLabel = Array.from(view.container.querySelectorAll("label")).find((label) =>
      label.textContent?.includes("Dynamic content for: Source")
    ) as HTMLLabelElement;
    expect(dynamicLabel.className).toContain("mb-3");
    expect((dynamicLabel.querySelector("span") as HTMLSpanElement).className).toContain("py-2");

    input(view.container.querySelector("textarea") as HTMLTextAreaElement, "replacement\nwith lines");
    await clickAsync(Array.from(view.container.querySelectorAll("button")).find((button) =>
      button.textContent === "Compose"
    ) as HTMLButtonElement);

    const composedPrompt = "Static instruction\nKeep spacing\nUse this source:\nreplacement\nwith lines\nEnd source";
    const composedOutput = Array.from(view.container.querySelectorAll("textarea")).at(-1) as HTMLTextAreaElement;
    expect(composedOutput.value).toBe(composedPrompt);
    input(composedOutput, "edited final\nprompt");
    await clickAsync(Array.from(view.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Copy")
    ) as HTMLButtonElement);

    expect(compose).toHaveBeenCalledWith(7, [{ id: 42, content: "replacement\nwith lines" }]);
    expect(clipboardWriteTextMock).toHaveBeenCalledWith("edited final\nprompt");
    expect(view.container.textContent).toContain("Copied");
    view.unmount();
  });
});
