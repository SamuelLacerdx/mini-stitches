import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/cadastro": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/login": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/perfil": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/admin": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
