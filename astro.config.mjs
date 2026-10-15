// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Graphik",
      cssVariable: "--font-graphik",
      options: {
        variants: [
          {
            src: ["./src/fonts/GraphikRegular.otf"],
            weight: 400,
            style: "normal",
          },
          {
            src: ["./src/fonts/GraphikMedium.otf"],
            weight: 500,
            style: "normal",
          },
          {
            src: ["./src/fonts/GraphikSemibold.otf"],
            weight: 700,
            style: "normal",
          },
        ],
      },
    },
  ],
  vite: {
    build: {
      rollupOptions: {
        output: {
          // p-slides derives event names from class names (new.target.name)
          keepNames: true,
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
            // @ts-ignore
            rename: { stripBase: 3 },
          },
        ],
      }),
    ],
  },
});
