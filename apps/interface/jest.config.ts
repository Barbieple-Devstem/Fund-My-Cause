import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx" } }] },
  moduleNameMapper: {
    // Workspace packages ship TypeScript source, and node_modules is excluded
    // from transformation — resolve them to source so ts-jest compiles them.
    "^@fund-my-cause/components$": "<rootDir>/../components-lib/src/index.ts",
    "^@fund-my-cause/components/(.*)$": "<rootDir>/../components-lib/src/$1",
    "^@fund-my-cause/shared-utils$":
      "<rootDir>/../../packages/shared-utils/src/index.ts",
    "^@fund-my-cause/shared-utils/(.*)$":
      "<rootDir>/../../packages/shared-utils/src/$1",
    "^@fund-my-cause/types$": "<rootDir>/../../packages/types/src/index.ts",
    "^@fund-my-cause/types/(.*)$": "<rootDir>/../../packages/types/src/$1",
    "^@/lib/soroban$": "<rootDir>/src/__mocks__/lib/soroban.ts",
    "^@/lib/constants$": "<rootDir>/src/__mocks__/lib/constants.ts",
    "^@/i18n/(.*)$": "<rootDir>/src/__mocks__/i18n/$1",
    "^next-intl$": "<rootDir>/src/__mocks__/next-intl.ts",
    "^next-intl/(.*)$": "<rootDir>/src/__mocks__/next-intl/$1.ts",
    "^@/hooks/useTheme$": "<rootDir>/src/__mocks__/hooks/useTheme.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFiles: ["<rootDir>/jest.polyfills.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: ["node_modules/(?!(@walletconnect|uint8arrays)/)"],
};

export default config;
