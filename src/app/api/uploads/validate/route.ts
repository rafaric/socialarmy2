import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import sharp from "sharp";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;  // 50 MB

interface Signature {
  mime: string;
  bytes: number[];
  offset?: number;
}

const SIGNATURES: Signature[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png",  bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/gif",  bytes: [0x47, 0x49, 0x46, 0x38] },
  // WEBP: RIFF en bytes 0-3, luego WEBP en bytes 8-11
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
  { mime: "video/webm", bytes: [0x1a, 0x45, 0xdf, 0xa3] },
  // MP4: bytes 4-7 = "ftyp"
  { mime: "video/mp4",  bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
];

const FORMAT_TO_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  png:  "image/png",
  gif:  "image/gif",
  webp: "image/webp",
};

function detectMime(bytes: Uint8Array): string | null {
  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (bytes.length < offset + sig.bytes.length) continue;
    const matches = sig.bytes.every((b, i) => bytes[offset + i] === b);
    if (!matches) continue;

    // WEBP requiere verificación adicional en offset 8: "WEBP" (0x57 0x45 0x42 0x50)
    if (sig.mime === "image/webp") {
      const webpMagic = [0x57, 0x45, 0x42, 0x50];
      if (bytes.length < 12) continue;
      const webpOk = webpMagic.every((b, i) => bytes[8 + i] === b);
      if (!webpOk) continue;
    }

    return sig.mime;
  }
  return null;
}

export async function POST(req: NextRequest) {
  // 1. Auth check.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parsear multipart form data.
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  // 3. Verificar tamaño — primero el límite de video (mayor) para rechazar rápido.
  if (file.size > MAX_VIDEO_BYTES) {
    console.warn("[file_too_large] route=uploads/validate userId=%s size=%d", user.id, file.size);
    return NextResponse.json(
      { error: "File too large", maxBytes: MAX_VIDEO_BYTES },
      { status: 413 }
    );
  }

  // 4. Leer primeros 12 bytes para magic bytes detection.
  const headerBuffer = await file.slice(0, 12).arrayBuffer();
  const headerBytes = new Uint8Array(headerBuffer);
  const detected = detectMime(headerBytes);

  if (!detected) {
    console.warn("[invalid_mime] route=uploads/validate userId=%s detectedMime=null", user.id);
    return NextResponse.json(
      { error: "Unsupported media type", detectedMime: null },
      { status: 415 }
    );
  }

  // 5. Para imágenes: verificar tamaño de imagen y validar con sharp.
  if (detected.startsWith("image/")) {
    if (file.size > MAX_IMAGE_BYTES) {
      console.warn("[file_too_large] route=uploads/validate userId=%s size=%d mime=%s", user.id, file.size, detected);
      return NextResponse.json(
        { error: "File too large", maxBytes: MAX_IMAGE_BYTES },
        { status: 413 }
      );
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      const expectedMime = FORMAT_TO_MIME[metadata.format ?? ""];
      if (expectedMime !== detected) {
        console.warn("[invalid_mime] route=uploads/validate userId=%s detectedMime=%s sharpFormat=%s", user.id, detected, metadata.format);
        return NextResponse.json({ error: "Format mismatch" }, { status: 415 });
      }
    } catch {
      console.warn("[invalid_mime] route=uploads/validate userId=%s error=sharp_failed", user.id);
      return NextResponse.json({ error: "Invalid image" }, { status: 415 });
    }
  }

  // 6. Todo OK.
  return NextResponse.json({ valid: true, mime: detected });
}
