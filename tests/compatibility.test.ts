import { describe, expect, it } from "vitest";
import {
  assertPromptEngineM8Compatibility,
  getPromptEngineM8Compatibility,
  isPromptEngineM8ServiceVersionCompatible,
  PROMPT_ENGINE_M8_CONTRACT
} from "../src/runtime/compatibility.js";

describe("prompt-engine-m8 compatibility", () => {
  it("returns unknown without metadata", () => {
    const result = getPromptEngineM8Compatibility();
    expect(result.status).toBe("unknown");
    expect(result.expectedContract).toBe(PROMPT_ENGINE_M8_CONTRACT);
  });

  it("treats matching contract version or full id as compatible", () => {
    expect(getPromptEngineM8Compatibility({ contract_version: "0.0" }).status).toBe("compatible");
    expect(
      getPromptEngineM8Compatibility({ prompt_engine_m8_contract: PROMPT_ENGINE_M8_CONTRACT })
        .status
    ).toBe("compatible");
  });

  it("flags a mismatched contract version", () => {
    const result = getPromptEngineM8Compatibility({ prompt_contract_version: "2.0" });
    expect(result.status).toBe("incompatible");
    expect(result.reason).toContain("2.0");
  });

  it("checks the service version range", () => {
    expect(isPromptEngineM8ServiceVersionCompatible("0.0.1")).toBe(true);
    expect(isPromptEngineM8ServiceVersionCompatible("0.0.5")).toBe(true);
    expect(isPromptEngineM8ServiceVersionCompatible("0.1.0")).toBe(false);
    expect(isPromptEngineM8ServiceVersionCompatible("1.0.0")).toBe(false);
    expect(isPromptEngineM8ServiceVersionCompatible("not-a-version")).toBe(false);
  });

  it("flags an incompatible service version", () => {
    const inline = getPromptEngineM8Compatibility({ prompt_engine_m8_version: "0.1.0" });
    expect(inline.status).toBe("incompatible");
    expect(inline.reason).toContain("0.1.0");

    const meta = getPromptEngineM8Compatibility({ service_version: "1.0.0" });
    expect(meta.status).toBe("incompatible");
  });

  it("reads nested contract.version and version", () => {
    const compat = getPromptEngineM8Compatibility({
      contract: { name: "prompt-engine-m8", version: "0.0" },
      version: "0.0.1"
    });
    expect(compat.status).toBe("compatible");
    expect(compat.contractVersion).toBe("0.0");
    expect(compat.serviceVersion).toBe("0.0.1");
  });

  it("asserts compatible metadata and rejects otherwise", () => {
    expect(() =>
      assertPromptEngineM8Compatibility({ contract_version: "0.0" }, false)
    ).not.toThrow();
    expect(() => assertPromptEngineM8Compatibility({})).toThrow();
    expect(() =>
      assertPromptEngineM8Compatibility({ prompt_contract_version: "1.0" }, false)
    ).toThrow(/1.0/);
  });
});