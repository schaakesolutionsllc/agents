/**
 * Shared setup for e2e tests
 */

import { OpenRouterProvider } from "../../src/index.js";

export function skipIfNoApiKey(): boolean {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log("  Skipping e2e test: OPENROUTER_API_KEY not set");
    return true;
  }
  return false;
}

export function createProvider(): OpenRouterProvider {
  return new OpenRouterProvider();
}

export const TEST_MODEL = "google/gemini-2.5-flash";
