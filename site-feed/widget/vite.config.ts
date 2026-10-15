import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/feed-widget.ts",
      formats: ["es"],
      fileName: () => "feed-widget.js",
    },
    outDir: "dist",
  },
});
