import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 3000,
  },
  base: "/ar_house/",
  assetsInclude: ["**/*.glb"],
});
