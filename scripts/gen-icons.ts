import sharp from "sharp";
import { join } from "path";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#070b16"/>
  <rect width="512" height="512" rx="80" fill="url(#g)"/>
  <defs>
    <radialGradient id="g" cx="30%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#130d2e"/>
      <stop offset="100%" stop-color="#070b16"/>
    </radialGradient>
  </defs>
  <!-- BTS purple heart / ARMY logo stylized -->
  <text x="256" y="300" font-size="220" text-anchor="middle" font-family="serif" fill="#7c4dce">A</text>
  <text x="256" y="420" font-size="64" text-anchor="middle" font-family="sans-serif" letter-spacing="12" fill="#c9a84c">ARMY</text>
</svg>`;

const publicDir = join(import.meta.dir, "../public");

async function generate(size: number, filename: string) {
  const buf = Buffer.from(svg);
  await sharp(buf)
    .resize(size, size)
    .png()
    .toFile(join(publicDir, filename));
  console.log(`✓ ${filename}`);
}

await generate(192, "icon-192.png");
await generate(512, "icon-512.png");
