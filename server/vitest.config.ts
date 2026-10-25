import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Lab 4: every API suite uses the same real database. Run in parallel, one
    // file could insert rows while another was counting them, which made a
    // Lab 3 test flaky and would make the dashboard SQL checks (API-50) flaky
    // too. Files now run one after another; tests inside a file never did.
    fileParallelism: false,
  },
});
