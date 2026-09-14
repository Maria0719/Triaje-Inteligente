import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // @mediapipe/tasks-vision ships as a pre-bundled ESM file that loads WASM at
  // runtime via fetch. Excluding it from Vite's optimizer avoids issues with
  // top-level await and dynamic imports inside the bundle.
  optimizeDeps: {
    exclude: ["@mediapipe/tasks-vision"],
  },
}));
