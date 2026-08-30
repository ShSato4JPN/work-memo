import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["react", "typescript", "unicorn"],
  env: {
    browser: true,
    node: true,
    es2024: true,
  },
  ignorePatterns: ["node_modules", ".next", "src/components/ui"],
  rules: {
    "no-unused-vars": "error",
    "no-console": "warn",
  },
  overrides: [
    {
      files: ["scripts/**/*.ts", "prisma/seed.ts"],
      rules: {
        "no-console": "off",
      },
    },
  ],
});
