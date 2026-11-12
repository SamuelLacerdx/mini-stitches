import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_URL || env.API_URL || "http://localhost:4000";
  const api = { target: apiTarget, changeOrigin: true, secure: false };

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      // "^/perfil/" e "^/admin/" (com barra) para que as páginas /perfil e
      // /admin do React não sejam enviadas ao backend ao recarregar.
      proxy: {
        "/api": api,
        "/sair": api,
        "^/perfil/": api,
        "^/admin/": api,
      },
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
    },
  };
});
