export const PROMPT_ENGINE_M8_CONTRACT_ID = "prompt-engine-m8";
export const PROMPT_ENGINE_M8_CONTRACT_VERSION = "1.0";
export const PROMPT_ENGINE_M8_CONTRACT = `${PROMPT_ENGINE_M8_CONTRACT_ID}@${PROMPT_ENGINE_M8_CONTRACT_VERSION}` as const;
export const PROMPT_ENGINE_M8_TESTED_SERVICE_VERSION = "1.1.0";
export const PROMPT_ENGINE_M8_MIN_SERVICE_VERSION = "1.0.0";
export const PROMPT_ENGINE_M8_MAX_SERVICE_VERSION_EXCLUSIVE = "2.0.0";
export const PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE = `>=${PROMPT_ENGINE_M8_MIN_SERVICE_VERSION} <${PROMPT_ENGINE_M8_MAX_SERVICE_VERSION_EXCLUSIVE}`;

export type PromptEngineM8CompatibilityStatus = "compatible" | "incompatible" | "unknown";

export type PromptEngineM8VersionMetadata = {
  contract?: unknown;
  contract_version?: unknown;
  prompt_contract?: unknown;
  prompt_contract_version?: unknown;
  prompt_engine_m8_contract?: unknown;
  version?: unknown;
  service_version?: unknown;
  prompt_engine_m8_version?: unknown;
  service?: unknown;
  api_version?: unknown;
};

export type PromptEngineM8Compatibility = {
  status: PromptEngineM8CompatibilityStatus;
  expectedContract: typeof PROMPT_ENGINE_M8_CONTRACT;
  expectedServiceVersionRange: typeof PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE;
  contractVersion?: string;
  serviceVersion?: string;
  reason?: string;
};

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function contractObjectVersion(value: unknown): string | undefined {
  if (typeof value === "object" && value !== null) {
    return stringValue((value as { version?: unknown }).version);
  }
  return undefined;
}

function parseSemver(version: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(left: string, right: string): number | undefined {
  const parsedLeft = parseSemver(left);
  const parsedRight = parseSemver(right);
  if (!parsedLeft || !parsedRight) return undefined;
  for (let index = 0; index < parsedLeft.length; index += 1) {
    if (parsedLeft[index] > parsedRight[index]) return 1;
    if (parsedLeft[index] < parsedRight[index]) return -1;
  }
  return 0;
}

export function isPromptEngineM8ServiceVersionCompatible(version: string): boolean {
  const aboveMin = compareSemver(version, PROMPT_ENGINE_M8_MIN_SERVICE_VERSION);
  const belowMax = compareSemver(version, PROMPT_ENGINE_M8_MAX_SERVICE_VERSION_EXCLUSIVE);
  return aboveMin !== undefined && belowMax !== undefined && aboveMin >= 0 && belowMax < 0;
}

export function getPromptEngineM8Compatibility(
  metadata: PromptEngineM8VersionMetadata = {}
): PromptEngineM8Compatibility {
  const contractVersion =
    stringValue(metadata.prompt_contract_version) ??
    stringValue(metadata.contract_version) ??
    stringValue(metadata.prompt_engine_m8_contract) ??
    stringValue(metadata.prompt_contract) ??
    contractObjectVersion(metadata.contract) ??
    stringValue(metadata.contract);
  const serviceVersion =
    stringValue(metadata.prompt_engine_m8_version) ??
    stringValue(metadata.service_version) ??
    stringValue(metadata.version);

  if (
    contractVersion &&
    contractVersion !== PROMPT_ENGINE_M8_CONTRACT_VERSION &&
    contractVersion !== PROMPT_ENGINE_M8_CONTRACT
  ) {
    return {
      status: "incompatible",
      expectedContract: PROMPT_ENGINE_M8_CONTRACT,
      expectedServiceVersionRange: PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE,
      contractVersion,
      serviceVersion,
      reason: `Expected ${PROMPT_ENGINE_M8_CONTRACT}, received ${contractVersion}`
    };
  }

  if (serviceVersion && !isPromptEngineM8ServiceVersionCompatible(serviceVersion)) {
    return {
      status: "incompatible",
      expectedContract: PROMPT_ENGINE_M8_CONTRACT,
      expectedServiceVersionRange: PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE,
      contractVersion,
      serviceVersion,
      reason: `Expected prompt-engine-m8 service version ${PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE}, received ${serviceVersion}`
    };
  }

  if (contractVersion || serviceVersion) {
    return {
      status: "compatible",
      expectedContract: PROMPT_ENGINE_M8_CONTRACT,
      expectedServiceVersionRange: PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE,
      contractVersion,
      serviceVersion
    };
  }

  return {
    status: "unknown",
    expectedContract: PROMPT_ENGINE_M8_CONTRACT,
    expectedServiceVersionRange: PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE,
    reason: "No prompt-engine-m8 contract or service version metadata was provided"
  };
}

export function assertPromptEngineM8Compatibility(
  metadata: PromptEngineM8VersionMetadata,
  requireKnown = true
): PromptEngineM8Compatibility {
  const compatibility = getPromptEngineM8Compatibility(metadata);
  if (
    compatibility.status === "incompatible" ||
    (requireKnown && compatibility.status === "unknown")
  ) {
    throw new Error(compatibility.reason);
  }
  return compatibility;
}