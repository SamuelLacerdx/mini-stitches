import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_URL || env.API_URL || "http://localhost:4000";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/cadastro": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        "/login": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        "/sair": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        "/perfil": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        "/admin": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
    },
  };
});
