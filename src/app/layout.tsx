import "@/styles/globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";
import localFont from "next/font/local";
import type { Metadata, Viewport } from "next";

const monotone = localFont({
  src: "../../public/assets/fonts/Monoton-Regular.ttf",
  variable: "--font-monotone",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://socialarmy.vercel.app"),
  title: {
    default: "Social Army",
    template: "%s · Social Army",
  },
  description: "La red social exclusiva para el BTS Army. Compartí posts, conectá con otras ARMYs y mostrá tu amor por BTS.",
  keywords: ["BTS", "Army", "KPOP", "social network", "red social", "BTS Army"],
  authors: [{ name: "Social Army" }],
  creator: "Social Army",
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://socialarmy.vercel.app",
    siteName: "Social Army",
    title: "Social Army — La red social del BTS Army",
    description: "La red social exclusiva para el BTS Army. Compartí posts, conectá con otras ARMYs y mostrá tu amor por BTS.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Social Army — La red social del BTS Army",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Social Army — La red social del BTS Army",
    description: "La red social exclusiva para el BTS Army.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#070b16" }],
};

// External icon font loaded via <link> to avoid Tailwind v4 CSS processing issues
const UICONS_CDN = "https://cdn-uicons.flaticon.com/uicons-bold-rounded/css/uicons-bold-rounded.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning className={monotone.variable}>
      <head>
        <link rel="preconnect" href="https://cdn-uicons.flaticon.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={UICONS_CDN} />
      </head>
      <body suppressHydrationWarning>
        {/* Skip link — visible on focus for keyboard/screen reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium focus:text-white"
          style={{ background: "var(--accent)" } as React.CSSProperties}
        >
          Saltar al contenido principal
        </a>
        <div className="aurora-bg" aria-hidden="true" />
        <Providers>{children}</Providers>
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            style: {
              background: "var(--bg-surface)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            },
          }}
        />
      </body>
    </html>
  );
}
