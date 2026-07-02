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
    click(view.container.querySelector("button") as HTMLButtonElement);
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
});
