// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://astro.build/config
export default defineConfig({
  experimental: {
    fonts: [
      {
        provider: fontProviders.local(),
        name: "Graphik Semibold",
        cssVariable: "--talk-marco-graphik-semibold",
        options: {
          variants: [
            {
              src: ["./src/fonts/GraphikSemibold.otf"],
              weight: 700,
              style: "normal",
            },
          ],
        },
      },
      {
        provider: fontProviders.local(),
        name: "Graphik Regular",
        cssVariable: "--talk-marco-graphik-regular",
        options: {
          variants: [
            {
              src: ["./src/fonts/GraphikRegular.otf"],
              weight: 400,
              style: "normal",
            },
          ],
        },
      },
      {
        provider: fontProviders.local(),
        name: "Graphik Medium",
        cssVariable: "--talk-marco-graphik-medium",
        options: {
          variants: [
            {
              src: ["./src/fonts/GraphikMedium.otf"],
              weight: 500,
              style: "normal",
            },
          ],
        },
      },
    ],
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes("src/vendor")) {
              return "vendor/[name]";
            }
          },
        },
      },
    },
    plugins: [
      // @ts-ignore
      viteStaticCopy({
        targets: [
          {
            src: "node_modules/p-slides/css/deck.css",
            dest: "css",
          },
        ],
      }),
    ],
  },
});
