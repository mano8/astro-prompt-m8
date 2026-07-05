import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import faPrompt from "@mano8/astro-prompt-m8";

export default defineConfig({
  integrations: [
    react(),
    starlight({
      title: "Prompt starter fixture",
      sidebar: [
        {
          label: "Prompt",
          items: [
            { label: "Blocks", link: "/prompt/blocks" },
            { label: "Templates", link: "/prompt/templates" },
            { label: "Composer", link: "/prompt/composer" },
            { label: "Admin", link: "/admin/prompts" }
          ]
        }
      ]
    }),
    faPrompt({
      mode: "starter",
      apiBase: "/prompt",
      apiPrefix: "/fastapi",
      auth: { provider: "none" }
    })
  ]
});
