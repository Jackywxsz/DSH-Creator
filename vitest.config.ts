import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // macOS recursive fs.watch can drop the first event while other test files
    // are creating large temporary directory bursts. The plugin runs one
    // library watcher, so serial files are both representative and stable.
    fileParallelism: false,
  },
});
