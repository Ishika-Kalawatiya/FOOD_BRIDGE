import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        donate: resolve(__dirname, "donate.html"),
        courier: resolve(__dirname, "courier.html"),
        ngoHub: resolve(__dirname, "ngo-hub.html"),
        portal: resolve(__dirname, "portal.html"),
        app: resolve(__dirname, "app.html"),
      },
    },
  },
});
