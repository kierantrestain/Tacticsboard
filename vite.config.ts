import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Reuse the production Vercel Function for local development.
// @ts-expect-error JavaScript route is deployed independently by Vercel.
import football from "./api/football.js";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "football-api",
      configureServer(server) {
        server.middlewares.use("/api/football", (req, res) => {
          void football(req, res);
        });
      },
    },
  ],
  server: { host: "0.0.0.0", allowedHosts: ["terminal.local"] },
  build: {
    target: "es2022",
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "canvas",
              test: /node_modules\/(konva|react-konva|react-reconciler|its-fine)\//,
              priority: 20,
            },
            {
              name: "react",
              test: /node_modules\/(react|react-dom|scheduler)\//,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
