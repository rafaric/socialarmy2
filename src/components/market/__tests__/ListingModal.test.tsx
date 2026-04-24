import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { UserCard, Card } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMutateAsync = vi.fn();
const mockCreateListing = { mutateAsync: mockMutateAsync, isPending: false };

vi.mock("@/hooks/useMarket", () => ({
  useCreateListing: () => mockCreateListing,
}));

// next/image: renderiza un img simple
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; fill?: boolean; sizes?: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} />
  ),
}));

// framer-motion: renderiza children directamente
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { exit?: unknown; initial?: unknown; animate?: unknown; transition?: unknown }) => (
      <div {...(Object.fromEntries(Object.entries(props).filter(([k]) => !["exit","initial","animate","transition"].includes(k))))}>{children}</div>
    ),
  },
}));

// sonner: mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import ListingModal from "../ListingModal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_CARD: UserCard & { cards: Card } = {
  user_id: "user-1",
  card_definition_id: "card-def-1",
  quantity: 3,
  locked_quantity: 0,
  first_obtained_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  cards: {
    id: "card-def-1",
    name: "BTS RM Epic",
    member: "RM",
    era: "Butter",
    rarity: "epic",
    rarity_points: 8,
    image_url: "https://example.com/rm.jpg",
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ListingModal", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    (mockCreateListing as { isPending: boolean }).isPending = false;
  });

  describe("visibilidad", () => {
    it("se renderiza cuando open=true y card está presente", () => {
      render(<ListingModal card={MOCK_CARD} open={true} onClose={vi.fn()} />);
      expect(screen.getByText("Listar en el mercado")).toBeInTheDocument();
    });

    it("NO se renderiza cuando card=null", () => {
      render(<ListingModal card={null} open={true} onClose={vi.fn()} />);
      expect(screen.queryByText("Listar en el mercado")).not.toBeInTheDocument();
    });

    it("NO se renderiza cuando open=false", () => {
      render(<ListingModal card={MOCK_CARD} open={false} onClose={vi.fn()} />);
      expect(screen.queryByText("Listar en el mercado")).not.toBeInTheDocument();
    });
  });

  describe("muestra la carta correctamente", () => {
    it("muestra el nombre de la carta", () => {
      render(<ListingModal card={MOCK_CARD} open={true} onClose={vi.fn()} />);
      expect(screen.getByText("BTS RM Epic")).toBeInTheDocument();
    });

    it("muestra la rareza y los puntos", () => {
      render(<ListingModal card={MOCK_CARD} open={true} onClose={vi.fn()} />);
      expect(screen.getByText(/8 pts/)).toBeInTheDocument();
    });

    it("muestra la cantidad disponible", () => {
      render(<ListingModal card={MOCK_CARD} open={true} onClose={vi.fn()} />);
      // quantity=3, locked=0 → available=3
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("muestra la imagen de la carta", () => {
      render(<ListingModal card={MOCK_CARD} open={true} onClose={vi.fn()} />);
      const img = screen.getByAltText("BTS RM Epic");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/rm.jpg");
    });
  });

  describe("toggle auto_accept", () => {
    it("el toggle de auto_accept empieza en false", () => {
      render(<ListingModal card={MOCK_CARD} open={true} onClose={vi.fn()} />);
      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it("al clickear el toggle cambia a true", () => {
      render(<ListingModal card={MOCK_CARD} open={true} onClose={vi.fn()} />);
      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      fireEvent.change(checkbox, { target: { checked: true } });
      expect(checkbox.checked).toBe(true);
    });

    it("al clickear dos veces vuelve a false", () => {
      render(<ListingModal card={MOCK_CARD} open={true} onClose={vi.fn()} />);
      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      fireEvent.change(checkbox, { target: { checked: true } });
      fireEvent.change(checkbox, { target: { checked: false } });
      expect(checkbox.checked).toBe(false);
    });
  });

  describe("botón cancelar / cerrar", () => {
    it("llama onClose al hacer click en el botón ✕", () => {
      const onClose = vi.fn();
      render(<ListingModal card={MOCK_CARD} open={true} onClose={onClose} />);
      fireEvent.click(screen.getByLabelText("Cerrar"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("botón confirmar", () => {
    it("llama useCreateListing.mutateAsync al confirmar", async () => {
      mockMutateAsync.mockResolvedValue({ listing: {} });

      render(<ListingModal card={MOCK_CARD} open={true} onClose={vi.fn()} />);
      const confirmBtn = screen.getByRole("button", { name: /Confirmar listing/i });

      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(mockMutateAsync).toHaveBeenCalledWith({
        card_definition_id: "card-def-1",
        auto_accept: false,
      });
    });

    it("llama mutateAsync con auto_accept=true cuando el toggle está activado", async () => {
      mockMutateAsync.mockResolvedValue({ listing: {} });

      render(<ListingModal card={MOCK_CARD} open={true} onClose={vi.fn()} />);
      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;

      // El checkbox tiene sr-only — click directo dispara el onChange interno del componente
      await act(async () => {
        fireEvent.click(checkbox);
      });

      expect(checkbox.checked).toBe(true);

      const confirmBtn = screen.getByRole("button", { name: /Confirmar listing/i });

      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(mockMutateAsync).toHaveBeenCalledWith({
        card_definition_id: "card-def-1",
        auto_accept: true,
      });
    });

    it("el botón está deshabilitado cuando available_quantity < 1", () => {
      const cardNoDisp: UserCard & { cards: Card } = {
        ...MOCK_CARD,
        quantity: 1,
        locked_quantity: 1,
      };

      render(<ListingModal card={cardNoDisp} open={true} onClose={vi.fn()} />);
      const confirmBtn = screen.getByRole("button", { name: /Confirmar listing/i });
      expect(confirmBtn).toBeDisabled();
    });

    it("el botón está deshabilitado cuando isPending=true", () => {
      (mockCreateListing as { isPending: boolean }).isPending = true;

      render(<ListingModal card={MOCK_CARD} open={true} onClose={vi.fn()} />);
      const confirmBtn = screen.getByRole("button", { name: /Listando/i });
      expect(confirmBtn).toBeDisabled();
    });
  });
});
