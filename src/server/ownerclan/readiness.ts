export type OwnerclanReadiness = {
  mode: "api" | "csv_fallback" | "blocked";
  blockingReasons: string[];
};

export function evaluateOwnerclanReadiness(input: {
  apiApproved: boolean;
  hasApiCredentials: boolean;
  csvFallbackConfigured: boolean;
}): OwnerclanReadiness {
  const blockingReasons: string[] = [];

  if (!input.apiApproved) {
    blockingReasons.push("Ownerclan API is not approved");
  }

  if (input.apiApproved && !input.hasApiCredentials) {
    blockingReasons.push("Ownerclan API credentials are missing");
  }

  if (blockingReasons.length === 0) {
    return { mode: "api", blockingReasons: [] };
  }

  if (input.csvFallbackConfigured) {
    return { mode: "csv_fallback", blockingReasons };
  }

  return { mode: "blocked", blockingReasons };
}
