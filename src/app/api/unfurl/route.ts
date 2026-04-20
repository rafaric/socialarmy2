import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url requerida" }, { status: 400 });

  let url: string;
  try {
    url = new URL(raw).toString();
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  const mlRes = await fetch(
    `https://api.microlink.io?url=${encodeURIComponent(url)}&meta=true`,
    { headers: { "Accept": "application/json" } }
  ).catch(() => null);

  if (!mlRes?.ok) {
    return NextResponse.json({ error: "No se pudo obtener el contenido" }, { status: 502 });
  }

  const ml = await mlRes.json();

  // microlink devuelve status != success para contenido privado o inaccesible
  if (ml.status !== "success") {
    return NextResponse.json({ error: "private" }, { status: 422 });
  }

  const { description, title, image, url: resolvedUrl, author, publisher } = ml.data as {
    description?: string;
    title?: string;
    image?: { url?: string };
    url: string;
    author?: string;
    publisher?: string;
  };

  // Sin texto ni imagen = contenido privado o bloqueado
  if (!description && !title && !image?.url) {
    return NextResponse.json({ error: "private" }, { status: 422 });
  }

  const domain = (() => {
    try { return new URL(resolvedUrl).hostname.replace(/^www\./, ""); }
    catch { return new URL(url).hostname.replace(/^www\./, ""); }
  })();

  // Fetch image server-side to avoid CORS issues on client
  let imageBase64: string | null = null;
  let imageType: string | null = null;
  if (image?.url) {
    try {
      const imgRes = await fetch(image.url, { signal: AbortSignal.timeout(8000) });
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        if (buf.byteLength < 3_000_000) {
          imageBase64 = Buffer.from(buf).toString("base64");
          imageType = imgRes.headers.get("content-type") ?? "image/jpeg";
        }
      }
    } catch { /* imagen no disponible — continuamos sin ella */ }
  }

  // Derivar el nombre de la página/autor según la fuente
  let sourceLabel: string | null = author ?? null;

  if (!sourceLabel && domain.includes("facebook.com") && title) {
    // "Rolling Stone | Facebook" → "Rolling Stone"
    // "OT7Live - Facebook" → "OT7Live"
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
