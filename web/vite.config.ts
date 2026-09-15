import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      "/audio": "http://localhost:3001",
    },
  },
});
