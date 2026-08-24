// @vitest-environment jsdom
//
// `A-C3`: the island-root error boundary.
//
// The gate in `scripts/verify-fleet-gates.mjs` proves every island root is
// *wrapped*; these tests prove the wrapper actually does something — that a
// render throw is caught rather than propagated, that the caught message never
// reaches the DOM, and that both recovery paths work.
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// The island test drives the real `BlocksView` -> `Shell` -> boundary path, so
// the throw has to come from inside the view. Its list hook is the honest place
// to raise one: a hook that throws during render is precisely the failure that
// blanks an island, and it is not reachable by passing bad props.
const usePromptBlocksMock = vi.hoisted(() => vi.fn());
vi.mock("../src/runtime/hooks/usePromptBlocks.js", () => ({
  usePromptBlocks: usePromptBlocksMock
}));
// Keeps the provider's once-per-session `/meta` preflight off the network.
// Partial, so the rest of the module's surface (the api barrel re-exports all
// three entry points) still resolves.
vi.mock("../src/runtime/api/meta.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/runtime/api/meta.js")>()),
  runPromptEngineM8Preflight: () => Promise.resolve(null)
}));

import { PromptErrorBoundary } from "../src/runtime/react/PromptErrorBoundary.js";
import { BlocksView } from "../src/runtime/react/default-ui/index.js";

afterEach(cleanup);

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // React logs every caught render throw regardless of what the boundary does.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

function Boom({ throws, message = "render exploded" }: { throws: boolean; message?: string }) {
  if (throws) throw new Error(message);
  return <p>healthy child</p>;
}

describe("PromptErrorBoundary", () => {
  it("renders children while nothing throws", () => {
    render(
      <PromptErrorBoundary>
        <Boom throws={false} />
      </PromptErrorBoundary>
    );

    expect(screen.getByText("healthy child")).toBeTruthy();
    expect(document.querySelector("[data-prompt-error-boundary]")).toBeNull();
  });

  it("catches a render throw and renders the plugin error surface", () => {
    render(
      <PromptErrorBoundary>
        <Boom throws />
      </PromptErrorBoundary>
    );

    expect(document.querySelector('[data-prompt-error-boundary="fallback"]')).not.toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("This view stopped responding")).toBeTruthy();
    expect(screen.queryByText("healthy child")).toBeNull();
  });

  it("never renders the caught message, which may carry request detail", () => {
    render(
      <PromptErrorBoundary>
        <Boom throws message="failed for token=super-secret-value" />
      </PromptErrorBoundary>
    );

    expect(document.body.textContent).not.toContain("super-secret-value");
  });

  it("reports through onError and normalizes a non-Error throw", () => {
    const onError = vi.fn();

    function ThrowString(): React.ReactNode {
      throw "thrown as a string";
    }
    function ThrowObject(): React.ReactNode {
      throw { code: 500 };
    }

    render(
      <PromptErrorBoundary onError={onError}>
        <ThrowString />
      </PromptErrorBoundary>
    );
    render(
      <PromptErrorBoundary onError={onError}>
        <ThrowObject />
      </PromptErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(2);
    const [stringError, stringInfo] = onError.mock.calls[0] as [
      Error,
      { componentStack: string }
    ];
    const [objectError] = onError.mock.calls[1] as [Error];
    expect(stringError).toBeInstanceOf(Error);
    expect(stringError.message).toBe("thrown as a string");
    expect(typeof stringInfo.componentStack).toBe("string");
    expect(objectError.message).toBe("The view failed to render.");
  });

  it("accepts host label overrides", () => {
    render(
      <PromptErrorBoundary
        labels={{ title: "Biblioteca no disponible", retry: "Reintentar" }}
      >
        <Boom throws />
      </PromptErrorBoundary>
    );

    expect(screen.getByText("Biblioteca no disponible")).toBeTruthy();
    expect(screen.getByText("Reintentar")).toBeTruthy();
    // An unspecified label keeps its default rather than rendering empty.
    expect(
      screen.getByText("The page hit an unexpected error and could not finish rendering.")
    ).toBeTruthy();
  });

  it("renders a custom fallback with the error and a working reset", () => {
    function Harness() {
      const [throws, setThrows] = React.useState(true);
      return (
        <PromptErrorBoundary
          fallback={({ error, reset }) => (
            <button
              type="button"
              onClick={() => {
                setThrows(false);
                reset();
              }}
            >
              custom: {error.message}
            </button>
          )}
        >
          <Boom throws={throws} message="custom path" />
        </PromptErrorBoundary>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByText("custom: custom path"));
    expect(screen.getByText("healthy child")).toBeTruthy();
  });

  it("recovers through the default retry button", () => {
    function Harness() {
      const [throws, setThrows] = React.useState(true);
      return (
        <>
          <button type="button" onClick={() => setThrows(false)}>
            fix the child
          </button>
          <PromptErrorBoundary>
            <Boom throws={throws} />
          </PromptErrorBoundary>
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByText("fix the child"));
    fireEvent.click(screen.getByText("Reload this view"));
    expect(screen.getByText("healthy child")).toBeTruthy();
  });

  it("clears on a resetKeys change and holds while the keys are equal", () => {
    function Harness() {
      const [templateId, setTemplateId] = React.useState("t1");
      return (
        <>
          <button type="button" onClick={() => setTemplateId("t2")}>
            switch template
          </button>
          <button type="button" onClick={() => setTemplateId("t1")}>
            same template
          </button>
          <PromptErrorBoundary resetKeys={[templateId]}>
            <Boom throws={templateId === "t1"} />
          </PromptErrorBoundary>
        </>
      );
    }

    render(<Harness />);
    expect(screen.getByText("This view stopped responding")).toBeTruthy();

    fireEvent.click(screen.getByText("same template"));
    expect(screen.getByText("This view stopped responding")).toBeTruthy();

    fireEvent.click(screen.getByText("switch template"));
    expect(screen.getByText("healthy child")).toBeTruthy();
  });

  it("holds the fallback across a re-render when no resetKeys are given", () => {
    function Harness() {
      const [tick, setTick] = React.useState(0);
      return (
        <>
          <button type="button" onClick={() => setTick(tick + 1)}>
            re-render
          </button>
          <PromptErrorBoundary>
            <Boom throws />
          </PromptErrorBoundary>
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByText("re-render"));
    expect(screen.getByText("This view stopped responding")).toBeTruthy();
  });
});

describe("island roots", () => {
  it("contains a throw raised inside a mounted view", () => {
    // `BlocksView` is what `blocks.astro` mounts with `client:load`, so this
    // exercises the shipped island path — view, shell, both providers — rather
    // than a boundary mounted by hand.
    usePromptBlocksMock.mockImplementation(() => {
      throw new Error("the list hook threw during render");
    });

    render(<BlocksView />);

    expect(document.querySelector('[data-prompt-error-boundary="fallback"]')).not.toBeNull();
    expect(screen.getByText("This view stopped responding")).toBeTruthy();
  });

  it("renders the view normally when its hooks behave", () => {
    // The counterpart the previous test needs to mean anything: the same island
    // path with a healthy hook must render the view, not the fallback.
    usePromptBlocksMock.mockReturnValue({
      data: { data: [], count: 0 },
      loading: false,
      error: null,
      refresh: vi.fn(),
      createMutation: { isPending: false, mutateAsync: vi.fn() },
      updateMutation: { isPending: false, mutateAsync: vi.fn() },
      deleteMutation: { isPending: false, mutateAsync: vi.fn() }
    });

    render(<BlocksView />);

    expect(document.querySelector('[data-prompt-error-boundary="fallback"]')).toBeNull();
  });
});
