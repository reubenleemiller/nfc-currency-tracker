import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ test: { env: { DATABASE_URL: "file:./test.db", SESSION_SECRET: "test-secret-at-least-thirty-two-characters" }, fileParallelism: false }, resolve: { alias: { "@": path.resolve(__dirname) } } });
