import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // 🔥 STEP 5: Production Hardening
  build: {
    minify: 'esbuild',
    sourcemap: false, // Production mein source code hide rahega
    chunkSizeWarningLimit: 1600,
  },
  esbuild: {
    // Ye build bante waqt saare console logs aur debuggers ko uda dega
    drop: ['console', 'debugger'], 
  },
});
