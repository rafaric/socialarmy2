import "@/styles/globals.css";
import { Providers } from "./providers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Social Army",
  description: "La red social exclusiva para el BTS Army",
};

// External icon font loaded via <link> to avoid Tailwind v4 CSS processing issues
const UICONS_CDN = "https://cdn-uicons.flaticon.com/uicons-bold-rounded/css/uicons-bold-rounded.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="stylesheet" href={UICONS_CDN} />
      </head>
      <body suppressHydrationWarning>
        <div className="aurora-bg" aria-hidden="true" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
