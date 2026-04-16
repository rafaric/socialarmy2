import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Avatar from "@/components/Avatar";

// Simplificar el mock para Avatar
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
  it("renders with default props", () => {
    render(<Avatar />);
    // Avatar renderiza un div con la imagen por defecto
    const img = screen.getByRole("img", { hidden: true });
    expect(img).toBeInTheDocument();
  });

  it("renders with custom url when provided", () => {
    const customUrl = "https://example.com/avatar.jpg";
    render(<Avatar url={customUrl} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", customUrl);
  });

  it("renders with different sizes", () => {
    const { rerender } = render(<Avatar size="sm" />);
    expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();

    rerender(<Avatar size="lg" />);
    expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
  });
});