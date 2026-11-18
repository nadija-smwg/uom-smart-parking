import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "UoM Smart Parking", short_name: "UoM Parking",
    start_url: "/", scope: "/", display: "standalone",
    background_color: "#f3f0e6", theme_color: "#203a40",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
