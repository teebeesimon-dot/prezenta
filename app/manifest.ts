import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "prezenta",
    short_name: "prezenta",
    description:
      "Vezi cine vine. Joacă mai mult. Organizează rapid activități sportive.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0d0d",
    theme_color: "#22c55e",
    lang: "ro",
  };
}
