import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "book",
    short_name: "Reader",
    description: "reader",
    start_url: "/",
    display: "standalone",
    background_color: "#eaf6fd",
    theme_color: "#eaf6fd",
    icons: [],
  };
}
