// @vitest-environment jsdom
//
// C9 coverage for `H5`: the compatibility guard the A35/A36 wave built was
// exported, tested and called by nothing. These tests pin the live call site —
// that mounting a provider reads `GET /meta` once per session, that the verdict
// reaches consumers through `usePromptCompatibility`, and that a service which
// cannot be reached leaves the UI standing instead of taking it down.
import React, { type ReactNode } from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

import { PromptProvider } from "../src/runtime/react/PromptProvider.js";
import { usePromptCompatibility } from "../src/runtime/hooks/usePromptCompatibility.js";
import { resetPromptEngineM8Preflight } from "../src/runtime/api/meta.js";
import { resetPromptConfig } from "../src/runtime/config.js";

const compatibleMeta = {
  service: "prompt-engine-m8",
  version: "2.0.0",
  api_version: "v1",
  contract: { name: "prompt-engine-m8", version: "2.0.0", range: ">=2.0.0 <3.0.0" }
};

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    clone() {
      return this;
    },
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

function renderProbe(): { seen: ReturnType<typeof usePromptCompatibility>[]; unmount: () => void } {
  const seen: ReturnType<typeof usePromptCompatibility>[] = [];

  function Probe() {
    seen.push(usePromptCompatibility());
    return null;
  }

  const container = document.createElement("div");
  document.body.append(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(
      <PromptProvider>
        <Probe />
      </PromptProvider>
    );
  });
  return { seen, unmount: () => act(() => root.unmount()) };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function render(element: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(<>{element}</>);
  });
  return { unmount: () => act(() => root.unmount()) };
}

beforeEach(() => {
  resetPromptConfig();
  resetPromptEngineM8Preflight();
  document.body.innerHTML = "";
  fetchMock = vi.fn().mockResolvedValue(jsonResponse(compatibleMeta));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("session compatibility preflight (H5)", () => {
  it("reads {API_PREFIX}/meta when a provider mounts", async () => {
    const view = renderProbe();
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    // The path prompt-engine-m8 actually mounts through `mount_service_meta`.
    expect(new URL(url).pathname).toBe("/prompt/meta");
    expect(view.seen.at(-1)).toMatchObject({ loading: false, incompatible: false });
    expect(view.seen.at(-1)?.result?.status).toBe("compatible");
    view.unmount();
  });

  it("reads /meta once no matter how many providers mount", async () => {
    const first = renderProbe();
    const second = render(
      <PromptProvider>
        <span />
      </PromptProvider>
    );
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    first.unmount();
    second.unmount();
  });

  it("reports a sibling M8 service as incompatible, with a reason", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...compatibleMeta,
        service: "media-service-m8",
        contract: { name: "media-service-m8", version: "2.0.0", range: ">=2.0.0 <3.0.0" }
      })
    );
    const view = renderProbe();
    await settle();

    const last = view.seen.at(-1);
    expect(last?.incompatible).toBe(true);
    expect(last?.reason).toContain("media-service-m8");
    view.unmount();
  });

  it("leaves the UI standing when /meta cannot be reached", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const view = renderProbe();
    await settle();

    const last = view.seen.at(-1);
    // "We could not tell" must not read as "the service is wrong" — an
    // unreachable /meta would otherwise blank every prompt surface offline.
    expect(last?.incompatible).toBe(false);
    expect(last?.result).toMatchObject({ status: "unknown", unreachable: true });
    view.unmount();
  });

  it("starts in a loading state before /meta answers", () => {
    const view = renderProbe();
    expect(view.seen[0]).toMatchObject({ loading: true, incompatible: false, result: null });
    view.unmount();
  });
});
