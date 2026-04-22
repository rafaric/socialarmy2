import { NextRequest, NextResponse } from "next/server";
import { rateLimit, buildKey } from "@/lib/rate-limit";

function normalizeSocialUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.hostname === "m.facebook.com") u.hostname = "www.facebook.com";
    if (u.hostname === "m.instagram.com") u.hostname = "www.instagram.com";
    return u.toString();
  } catch {
    return raw;
  }
}

async function extractOgTags(url: string): Promise<{
  title?: string; description?: string; image?: string; siteName?: string;
} | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();

    const getTag = (name: string): string | null => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"))
        ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, "i"));
      return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim() : null;
    };

    return {
      title: getTag("og:title") ?? getTag("twitter:title") ?? undefined,
      description: getTag("og:description") ?? getTag("twitter:description") ?? undefined,
      image: getTag("og:image") ?? getTag("twitter:image") ?? undefined,
      siteName: getTag("og:site_name") ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const key = buildKey("unfurl", req, null);
  if (!rateLimit(key, 10, 60_000)) {
    console.warn("[rate_limit_exceeded] route=unfurl ip=%s", key.split(":ip:")[1] ?? "unknown");
    return NextResponse.json(
      { error: "Too many requests", retryAfter: 60 },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url requerida" }, { status: 400 });

  let url: string;
  try {
    url = normalizeSocialUrl(new URL(raw).toString());
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  // Try Microlink first
  const mlRes = await fetch(
    `https://api.microlink.io?url=${encodeURIComponent(url)}&meta=true`,
    { headers: { "Accept": "application/json" } }
  ).catch(() => null);

  const ml = mlRes?.ok ? await mlRes.json().catch(() => null) : null;

  let title: string | undefined;
  let description: string | undefined;
  let imageUrl: string | undefined;
  let resolvedUrl: string = url;
  let author: string | undefined;
  let publisher: string | undefined;

  if (ml?.status === "success" && (ml.data?.description || ml.data?.title || ml.data?.image?.url)) {
    title = ml.data.title;
    description = ml.data.description;
    imageUrl = ml.data.image?.url;
    resolvedUrl = ml.data.url ?? url;
    author = ml.data.author;
    publisher = ml.data.publisher;
  } else {
    // Fallback: fetch the page directly and extract OG tags
    const og = await extractOgTags(url);
    if (!og?.title && !og?.description && !og?.image) {
      return NextResponse.json({ error: "private" }, { status: 422 });
    }
    title = og.title ?? undefined;
    description = og.description ?? undefined;
    imageUrl = og.image ?? undefined;
    publisher = og.siteName ?? undefined;
  }

  // Facebook redirigió al login — contenido inaccesible sin autenticación
  if (resolvedUrl.includes("facebook.com/login") || resolvedUrl.includes("facebook.com/r.php")) {
    return NextResponse.json({ error: "login_required" }, { status: 422 });
  }

  const domain = (() => {
    try { return new URL(resolvedUrl).hostname.replace(/^www\./, ""); }
    catch { return new URL(url).hostname.replace(/^www\./, ""); }
  })();

  // Fetch image server-side to avoid CORS issues on client
  let imageBase64: string | null = null;
  let imageType: string | null = null;
  if (imageUrl) {
    try {
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        if (buf.byteLength < 3_000_000) {
          imageBase64 = Buffer.from(buf).toString("base64");
          imageType = imgRes.headers.get("content-type") ?? "image/jpeg";
        }
      }
    } catch { /* imagen no disponible — continuamos sin ella */ }
  }

  let sourceLabel: string | null = author ?? null;

  if (!sourceLabel && domain.includes("facebook.com") && title) {
    sourceLabel = title.replace(/\s*[|\-–]\s*Facebook.*$/i, "").trim() || null;
  }

  if (!sourceLabel && publisher && publisher.toLowerCase() !== domain) {
    sourceLabel = publisher;
  }

  return NextResponse.json({
    description: description ?? title ?? "",
    imageBase64,
    imageType,
    domain,
    source_url: resolvedUrl ?? url,
    source_label: sourceLabel,
  });
}
