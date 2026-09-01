import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/steal-tally-rescue-zhao/",
  plugins: [react()],
  build: {
    outDir: "dist-pages",
    emptyOutDir: true,
  },
});
