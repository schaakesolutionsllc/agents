import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import { resolve } from "path";

// Load .env files in priority order
// .env.test.local (highest priority) > .env.test > .env.local > .env
dotenv.config({ path: resolve(process.cwd(), ".env.test.local") });
dotenv.config({ path: resolve(process.cwd(), ".env.test") });
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

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
