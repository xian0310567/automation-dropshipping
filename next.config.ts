import type { NextConfig } from "next";
import { runProductionPreflight } from "./src/server/env-preflight";

const nextConfig: NextConfig = {
};

export default function config(phase: string): NextConfig {
  runProductionPreflight({
    ...process.env,
    NEXT_PHASE: phase,
  });

  return nextConfig;
}
