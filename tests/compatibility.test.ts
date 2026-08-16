import { describe, expect, it } from "vitest";
import {
  assertPromptEngineM8Compatibility,
  getPromptEngineM8Compatibility,
  isPromptEngineM8ServiceVersionCompatible,
  PROMPT_ENGINE_M8_CONTRACT,
  PROMPT_ENGINE_M8_CONTRACT_VERSION,
  PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE,
  PROMPT_ENGINE_M8_TESTED_SERVICE_VERSION
} from "../src/runtime/compatibility.js";

describe("prompt-engine-m8 compatibility", () => {
  it("exports the tested contract metadata", () => {
    expect(PROMPT_ENGINE_M8_CONTRACT).toBe("prompt-engine-m8@2.0.0");
    expect(PROMPT_ENGINE_M8_CONTRACT_VERSION).toBe("2.0.0");
    expect(PROMPT_ENGINE_M8_TESTED_SERVICE_VERSION).toBe("2.0.0");
    expect(PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE).toBe(">=2.0.0 <3.0.0");
  });

  it("returns unknown without metadata", () => {
    const result = getPromptEngineM8Compatibility();
    expect(result.status).toBe("unknown");
    expect(result.expectedContract).toBe(PROMPT_ENGINE_M8_CONTRACT);
  });

  it("treats matching contract version or full id as compatible", () => {
    expect(getPromptEngineM8Compatibility({ contract_version: "2.0.0" }).status).toBe("compatible");
    expect(
      getPromptEngineM8Compatibility({ prompt_engine_m8_contract: PROMPT_ENGINE_M8_CONTRACT })
        .status
    ).toBe("compatible");
  });

  it("flags a mismatched contract version", () => {
    const result = getPromptEngineM8Compatibility({ prompt_contract_version: "2.0" });
    expect(result.status).toBe("incompatible");
    expect(result.reason).toContain("2.0");
    expect(getPromptEngineM8Compatibility({ contract_version: "0.0" }).status).toBe("incompatible");
  });

  it("checks the service version range", () => {
    expect(isPromptEngineM8ServiceVersionCompatible("2.0.0")).toBe(true);
    expect(isPromptEngineM8ServiceVersionCompatible("2.1.0")).toBe(true);
    expect(isPromptEngineM8ServiceVersionCompatible("2.1.0-beta+build.1")).toBe(true);
    expect(isPromptEngineM8ServiceVersionCompatible("2.9.5")).toBe(true);
    expect(isPromptEngineM8ServiceVersionCompatible("0.0.1")).toBe(false);
    // The retired 1.x baseline this guard used to admit is now a real deny case.
    expect(isPromptEngineM8ServiceVersionCompatible("1.1.0")).toBe(false);
    expect(isPromptEngineM8ServiceVersionCompatible("1.9.9")).toBe(false);
    expect(isPromptEngineM8ServiceVersionCompatible("3.0.0")).toBe(false);
    expect(isPromptEngineM8ServiceVersionCompatible("not-a-version")).toBe(false);
  });

  it("flags an incompatible service version", () => {
    const inline = getPromptEngineM8Compatibility({ prompt_engine_m8_version: "3.0.0" });
    expect(inline.status).toBe("incompatible");
    expect(inline.reason).toContain("3.0.0");

    const meta = getPromptEngineM8Compatibility({ service_version: "0.0.1" });
    expect(meta.status).toBe("incompatible");
  });

  it("reads nested contract.version and version", () => {
    const compat = getPromptEngineM8Compatibility({
      contract: { name: "prompt-engine-m8", version: "2.0.0" },
      version: "2.0.0"
    });
    expect(compat.status).toBe("compatible");
    expect(compat.contractVersion).toBe("2.0.0");
    expect(compat.serviceVersion).toBe("2.0.0");
    expect(getPromptEngineM8Compatibility({ version: "2.0.0", contract: { version: "0.0" } }).status).toBe(
      "incompatible"
    );
  });

  it("admits the live prompt-engine-m8 GET /meta payload verbatim", () => {
    // Verbatim auth-sdk-m8 ServiceMeta as prompt-engine-m8 serves it at
    // {API_PREFIX}/meta: PROJECT_NAME, __version__ and the CONTRACT_* settings
    // measured at the service's HEAD. Hand-written flat fixtures are how the
    // service-version axis drifted a full major behind unnoticed.
    const meta = {
      service: "PromptEngineM8",
      version: "2.0.0",
      api_version: "v1",
      contract: {
        name: "prompt-engine-m8",
        version: "2.0.0",
        range: ">=2.0.0 <3.0.0"
      }
    };
    expect(getPromptEngineM8Compatibility(meta)).toMatchObject({
      status: "compatible",
      contractVersion: "2.0.0",
      serviceVersion: "2.0.0"
    });
    expect(() => assertPromptEngineM8Compatibility(meta)).not.toThrow();

    // Adjacent out-of-range service version on the same payload shape.
    const nextMajor = { ...meta, version: "3.0.0" };
    expect(getPromptEngineM8Compatibility(nextMajor)).toMatchObject({
      status: "incompatible",
      serviceVersion: "3.0.0"
    });
  });

  it("asserts compatible metadata and rejects otherwise", () => {
    expect(() =>
      assertPromptEngineM8Compatibility({ contract_version: "2.0.0" }, false)
    ).not.toThrow();
    expect(() => assertPromptEngineM8Compatibility({})).toThrow();
    expect(() =>
      assertPromptEngineM8Compatibility({ prompt_contract_version: "0.0" }, false)
    ).toThrow(/0.0/);
    expect(assertPromptEngineM8Compatibility({ service_version: "2.0.0" })).toMatchObject({
      status: "compatible"
    });
  });
});
