import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock next/headers para evitar hang en jsdom
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

// Mock Supabase server client
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

// Mock sharp — por defecto retorna metadata válida de JPEG
const mockSharpMetadata = vi.fn().mockResolvedValue({ format: "jpeg" });
vi.mock("sharp", () => ({
  default: vi.fn(() => ({ metadata: mockSharpMetadata })),
}));

/**
 * Crea un NextRequest con formData mockeada para evitar el hang de jsdom
 * con multipart bodies.
 */
function makeRequestWithFile(
  bytes: number[],
  options: { size?: number; authenticated?: boolean } = {}
): NextRequest {
  const { size, authenticated = true } = options;
  const data = new Uint8Array(bytes);
  const file = new File([data], "test.bin", { type: "application/octet-stream" });

  // Si queremos simular un tamaño diferente al real
  if (size !== undefined) {
    Object.defineProperty(file, "size", { value: size, writable: false });
  }

  // Crear request y mockear formData()
  const req = new NextRequest("http://localhost/api/uploads/validate", {
    method: "POST",
    headers: authenticated ? { "x-test-auth": "true" } : {},
  });

  // Mock formData para evitar el hang en jsdom con multipart
  vi.spyOn(req, "formData").mockResolvedValue(
    Object.assign(new FormData(), {
      get: (key: string) => (key === "file" ? file : null),
    }) as FormData
  );

  return req;
}

function makeRequestNoFile(authenticated = true): NextRequest {
  const req = new NextRequest("http://localhost/api/uploads/validate", {
    method: "POST",
    headers: authenticated ? { "x-test-auth": "true" } : {},
  });
  vi.spyOn(req, "formData").mockResolvedValue(
    Object.assign(new FormData(), {
      get: (_key: string) => null,
    }) as FormData
  );
  return req;
}

describe("POST /api/uploads/validate", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSharpMetadata.mockResolvedValue({ format: "jpeg" });
  });

  it("responde 401 si no hay usuario autenticado", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("@/app/api/uploads/validate/route");
    const bytes = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
    const req = makeRequestWithFile(bytes, { authenticated: false });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("responde 413 si el archivo supera 50 MB (video)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { POST } = await import("@/app/api/uploads/validate/route");
    const bytes = [0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0];
    const req = makeRequestWithFile(bytes, { size: 52_428_801 });
    const res = await POST(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.maxBytes).toBe(52_428_800);
  });

  it("responde 413 si el archivo supera 5 MB siendo imagen", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { POST } = await import("@/app/api/uploads/validate/route");
    const bytes = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
    const req = makeRequestWithFile(bytes, { size: 5_242_881 });
    const res = await POST(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.maxBytes).toBe(5_242_880);
  });

  it("responde 415 si los bytes no son reconocidos", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { POST } = await import("@/app/api/uploads/validate/route");
    const bytes = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b];
    const req = makeRequestWithFile(bytes);
    const res = await POST(req);
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.detectedMime).toBeNull();
  });

  describe("detectMime — magic bytes", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    });

    it("detecta JPEG correctamente → 200", async () => {
      const { POST } = await import("@/app/api/uploads/validate/route");
      mockSharpMetadata.mockResolvedValue({ format: "jpeg" });
      const bytes = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
      const req = makeRequestWithFile(bytes);
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mime).toBe("image/jpeg");
    });

    it("detecta PNG correctamente → 200", async () => {
      const { POST } = await import("@/app/api/uploads/validate/route");
      mockSharpMetadata.mockResolvedValue({ format: "png" });
      const bytes = [0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0];
      const req = makeRequestWithFile(bytes);
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mime).toBe("image/png");
    });

    it("detecta GIF correctamente → 200", async () => {
      const { POST } = await import("@/app/api/uploads/validate/route");
      mockSharpMetadata.mockResolvedValue({ format: "gif" });
      const bytes = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0];
      const req = makeRequestWithFile(bytes);
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mime).toBe("image/gif");
    });

    it("detecta WEBP (RIFF+WEBP) correctamente → 200", async () => {
      const { POST } = await import("@/app/api/uploads/validate/route");
      mockSharpMetadata.mockResolvedValue({ format: "webp" });
      // RIFF en 0-3, tamaño arbitrario en 4-7, WEBP en 8-11
      const bytes = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
      const req = makeRequestWithFile(bytes);
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mime).toBe("image/webp");
    });

    it("detecta WebM correctamente → 200 (sin sharp)", async () => {
      const { POST } = await import("@/app/api/uploads/validate/route");
      const bytes = [0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0];
      const req = makeRequestWithFile(bytes);
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mime).toBe("video/webm");
    });
  });

  it("responde 415 si sharp lanza (imagen con header válido pero inválida)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { POST } = await import("@/app/api/uploads/validate/route");
    mockSharpMetadata.mockRejectedValue(new Error("Input buffer contains unsupported image format"));
    const bytes = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
    const req = makeRequestWithFile(bytes);
    const res = await POST(req);
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toBe("Invalid image");
  });

  it("responde 200 con imagen válida que pasa sharp", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { POST } = await import("@/app/api/uploads/validate/route");
    mockSharpMetadata.mockResolvedValue({ format: "jpeg" });
    const bytes = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
    const req = makeRequestWithFile(bytes);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.mime).toBe("image/jpeg");
  });
});
