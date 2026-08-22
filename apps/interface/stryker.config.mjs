/**
 * @type {import('@stryker-mutator/core').PartialStrykerOptions}
 */
export default {
  packageManager: "npm",
  testRunner: "jest",
  coverageAnalysis: "perTest",
  mutate: [
    "src/lib/**/*.ts",
    "src/lib/**/*.tsx",
    "src/services/**/*.ts",
    "!src/lib/**/*.test.ts",
    "!src/lib/**/*.test.tsx",
    "!src/services/**/*.test.ts",
    "!src/lib/__tests__/**",
    "!src/lib/cache/**",
  ],
  reporters: ["html", "clear-text", "progress", "json"],
  htmlReporter: {
    fileName: "mutation-report.html",
  },
  jsonReporter: {
    fileName: "mutation-report.json",
  },
  thresholds: { high: 80, low: 60, break: 50 },
  timeoutMS: 60000,
  maxConcurrentTestRunners: 2,
  ignorePatterns: [
    "node_modules",
    "dist",
    ".next",
    "coverage",
    "**/*.d.ts",
    "**/__mocks__/**",
  ],
};
