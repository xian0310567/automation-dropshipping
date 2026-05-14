import {
  assertProductionEnv,
  getServerEnv,
  shouldRunProductionPreflight,
} from "./env-core";

export function runProductionPreflight(env = process.env): void {
  if (shouldRunProductionPreflight(env)) {
    assertProductionEnv(getServerEnv(env));
  }
}
