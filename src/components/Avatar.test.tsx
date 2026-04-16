import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Avatar from "@/components/Avatar";

vi.mock("@/lib/supabase/browser", () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: () => ({ data: { publicUrl: "mock-url" } }),
      }),
    },
  },
}));

describe("Avatar", () => {
  it("renderiza un placeholder SVG cuando no se pasa url", () => {
    render(<Avatar />);
    // Sin URL renderiza el Placeholder (div + SVG), no un <img>
    expect(screen.queryByRole("img")).toBeNull();
    // El contenedor principal siempre está presente
    expect(document.querySelector(".rounded-full")).toBeInTheDocument();
  });

  it("renderiza una imagen cuando se pasa url", () => {
    render(<Avatar url="https://example.com/avatar.jpg" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
    expect(img).toHaveAttribute("alt", "avatar");
  });

  it("no renderiza imagen cuando url es null", () => {
    render(<Avatar url={null} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("aplica tamaño sm correctamente", () => {
    render(<Avatar url="https://example.com/a.jpg" size="sm" />);
    const img = screen.getByRole("img");
    expect(img.className).toContain("w-9");
    expect(img.className).toContain("h-9");
  });

  it("aplica tamaño lg correctamente", () => {
    render(<Avatar url="https://example.com/a.jpg" size="lg" />);
    const img = screen.getByRole("img");
    expect(img.className).toContain("w-20");
    expect(img.className).toContain("h-20");
  });

  it("agrega el wrapper de ring cuando ring=true", () => {
    const { container } = render(<Avatar url="https://example.com/a.jpg" ring />);
    // Con ring hay un wrapper extra con bg gradiente
    const wrappers = container.querySelectorAll(".rounded-full");
    expect(wrappers.length).toBeGreaterThan(1);
  });
});
