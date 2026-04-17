import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SocialArmy — La comunidad ARMY",
    short_name: "SocialArmy",
    description: "Red social para fans de BTS. Conectá con el Army, compartí tus posts y mostrá tu bias.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#8b5cf6",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["social", "entertainment"],
    lang: "es",
    dir: "ltr",
  };
}
