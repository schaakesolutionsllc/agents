import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.e2e.ts"],
    testTimeout: 60000, // 60s timeout for API calls
    hookTimeout: 30000,
    pool: "forks", // Run sequentially to avoid rate limits
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
