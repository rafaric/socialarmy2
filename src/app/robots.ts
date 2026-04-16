import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/profile/", "/post/"],
        disallow: [
          "/api/",
          "/auth/",
          "/notifications",
          "/friends",
          "/saved",
          "/search",
        ],
      },
    ],
    sitemap: "https://socialarmy.vercel.app/sitemap.xml",
  };
}
