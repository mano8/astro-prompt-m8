// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { PromptProvider, usePromptContext } from "../src/runtime/react/index.js";
import { getPromptConfig, resetPromptConfig } from "../src/runtime/config.js";

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
    rerender: (nextElement: ReactNode) =>
      act(() => {
        root.render(<>{nextElement}</>);
      }),
    unmount: () => act(() => root.unmount())
  };
}

beforeEach(() => {
  resetPromptConfig();
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("PromptProvider", () => {
  it("applies runtime config before children render", () => {
    let configDuringChildRender = { apiBase: "", apiPrefix: "" };

    function ConfigProbe() {
      const config = getPromptConfig();
      configDuringChildRender = {
        apiBase: config.apiBase,
        apiPrefix: config.apiPrefix
      };
      return null;
    }

    const view = render(
      <PromptProvider config={{ apiBase: "/prompt-api", apiPrefix: "/v1" }}>
        <ConfigProbe />
      </PromptProvider>
    );

    expect(configDuringChildRender).toEqual({ apiBase: "/prompt-api", apiPrefix: "/v1" });
    view.unmount();
  });

  it("exposes synchronous adapter users before effects run", () => {
    let context: ReturnType<typeof usePromptContext> | undefined;
    const user = { is_superuser: true };

    function Probe() {
      context = usePromptContext();
      return <span>{context.loading ? "loading" : String(context.isSuperuser)}</span>;
    }

    const adapter = {
      getAccessToken: () => "token",
      getUser: () => user,
      isSuperuser: (value: unknown) => Boolean((value as { is_superuser?: boolean } | null)?.is_superuser)
    };

    const view = render(
      <PromptProvider adapter={adapter}>
        <Probe />
      </PromptProvider>
    );

    expect(context?.loading).toBe(false);
    expect(context?.user).toBe(user);
    expect(context?.isSuperuser).toBe(true);
    expect(view.container.textContent).toBe("true");
    view.unmount();
  });
});
