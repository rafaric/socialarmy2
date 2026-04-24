import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RarityBadge from "../RarityBadge";

describe("RarityBadge", () => {
  describe("labels por rareza", () => {
    it("muestra 'Común' para common", () => {
      render(<RarityBadge rarity="common" />);
      expect(screen.getByText(/Común/)).toBeInTheDocument();
    });

    it("muestra 'Rara' para rare", () => {
      render(<RarityBadge rarity="rare" />);
      expect(screen.getByText(/Rara/)).toBeInTheDocument();
    });

    it("muestra 'Épica' para epic", () => {
      render(<RarityBadge rarity="epic" />);
      expect(screen.getByText(/Épica/)).toBeInTheDocument();
    });

    it("muestra 'Legendaria' para legendary", () => {
      render(<RarityBadge rarity="legendary" />);
      expect(screen.getByText(/Legendaria/)).toBeInTheDocument();
    });
  });

  describe("puntos por rareza", () => {
    it("muestra 1 pts para common", () => {
      render(<RarityBadge rarity="common" />);
      expect(screen.getByText(/1 pts/)).toBeInTheDocument();
    });

    it("muestra 4 pts para rare", () => {
      render(<RarityBadge rarity="rare" />);
      expect(screen.getByText(/4 pts/)).toBeInTheDocument();
    });

    it("muestra 8 pts para epic", () => {
      render(<RarityBadge rarity="epic" />);
      expect(screen.getByText(/8 pts/)).toBeInTheDocument();
    });

    it("muestra 16 pts para legendary", () => {
      render(<RarityBadge rarity="legendary" />);
      expect(screen.getByText(/16 pts/)).toBeInTheDocument();
    });

    it("NO muestra puntos cuando showPoints=false", () => {
      render(<RarityBadge rarity="epic" showPoints={false} />);
      expect(screen.queryByText(/pts/)).not.toBeInTheDocument();
    });
  });

  describe("colores por rareza", () => {
    it("aplica clase text-gray-400 para common", () => {
      const { container } = render(<RarityBadge rarity="common" />);
      expect(container.firstChild).toHaveClass("text-gray-400");
    });

    it("aplica clase text-blue-400 para rare", () => {
      const { container } = render(<RarityBadge rarity="rare" />);
      expect(container.firstChild).toHaveClass("text-blue-400");
    });

    it("aplica clase text-purple-400 para epic", () => {
      const { container } = render(<RarityBadge rarity="epic" />);
      expect(container.firstChild).toHaveClass("text-purple-400");
    });

    it("aplica clase text-yellow-400 para legendary", () => {
      const { container } = render(<RarityBadge rarity="legendary" />);
      expect(container.firstChild).toHaveClass("text-yellow-400");
    });
  });
});
