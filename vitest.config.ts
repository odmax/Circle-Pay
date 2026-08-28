import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Some tests dynamically import large client-component trees (e.g. the
    // projects performance suite pulls in framer-motion + base-ui). Under full
    // parallel load the first heavy transform can exceed the 5s default, which
    // produced an intermittent timeout. 20s gives ample headroom.
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
})
