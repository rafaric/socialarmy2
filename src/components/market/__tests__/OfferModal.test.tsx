import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { UserCard, Card, MarketListing } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const MOCK_INVENTORY: (UserCard & { cards: Card })[] = [
  {
    user_id: "user-1",
    card_definition_id: "epic-card-id",
    quantity: 2,
    locked_quantity: 0,
    first_obtained_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    cards: {
      id: "epic-card-id",
      name: "TWICE Dahyun Epic",
      member: "Dahyun",
      era: "Formula",
      rarity: "epic",
      rarity_points: 8,
      image_url: "https://example.com/dahyun.jpg",
    },
  },
  {
    user_id: "user-1",
    card_definition_id: "rare-card-id",
    quantity: 1,
    locked_quantity: 0,
    first_obtained_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    cards: {
      id: "rare-card-id",
      name: "BTS Jin Rare",
      member: "Jin",
      era: "Butter",
      rarity: "rare",
      rarity_points: 4,
      image_url: "https://example.com/jin.jpg",
    },
  },
  {
    user_id: "user-1",
    card_definition_id: "unavailable-card-id",
    quantity: 1,
    locked_quantity: 1, // available = 0
    first_obtained_at: "2024-01-03T00:00:00Z",
    updated_at: "2024-01-03T00:00:00Z",
    cards: {
      id: "unavailable-card-id",
      name: "BTS V Legendary",
      member: "V",
      era: "Dynamite",
      rarity: "legendary",
      rarity_points: 16,
      image_url: "https://example.com/v.jpg",
    },
  },
];

const mockMutateAsync = vi.fn();
const mockCreateOffer = { mutateAsync: mockMutateAsync, isPending: false };

vi.mock("@/hooks/useInventory", () => ({
  useInventory: () => ({ data: MOCK_INVENTORY }),
}));

vi.mock("@/hooks/useMarket", () => ({
  useCreateOffer: () => mockCreateOffer,
}));

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; fill?: boolean; sizes?: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} />
  ),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { exit?: unknown; initial?: unknown; animate?: unknown; transition?: unknown }) => (
      <div {...(Object.fromEntries(Object.entries(props).filter(([k]) => !["exit","initial","animate","transition"].includes(k))))}>{children}</div>
    ),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// RarityBadge: renderiza solo el texto de rareza
vi.mock("../RarityBadge", () => ({
  default: ({ rarity }: { rarity: string; showPoints?: boolean; className?: string }) => (
    <span data-testid="rarity-badge">{rarity}</span>
  ),
}));

import OfferModal from "../OfferModal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Listing de una carta EPIC (8 pts) — requiere al menos 8 pts para ofertar
const MOCK_LISTING_EPIC: MarketListing & { cards: Card } = {
  id: "listing-1",
  seller_id: "seller-1",
  card_definition_id: "epic-listed-id",
  auto_accept: false,
  status: "active",
  expires_at: "2099-01-01T00:00:00Z",
  created_at: "2026-04-23T00:00:00Z",
  completed_at: null,
  cards: {
    id: "epic-listed-id",
    name: "BTS RM Epic",
    member: "RM",
    era: "Butter",
    rarity: "epic",
    rarity_points: 8,
    image_url: "https://example.com/rm.jpg",
  },
};

// Listing de una carta COMMON (1 pt) — cualquier carta es válida
const MOCK_LISTING_COMMON: MarketListing & { cards: Card } = {
  ...MOCK_LISTING_EPIC,
  id: "listing-2",
  cards: {
    ...MOCK_LISTING_EPIC.cards,
    rarity: "common",
    rarity_points: 1,
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OfferModal", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    (mockCreateOffer as { isPending: boolean }).isPending = false;
  });

  describe("visibilidad", () => {
    it("se renderiza cuando isOpen=true y listing está presente", () => {
      render(<OfferModal listing={MOCK_LISTING_EPIC} isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByText("Hacer una oferta")).toBeInTheDocument();
    });

    it("NO se renderiza cuando listing=null", () => {
      render(<OfferModal listing={null} isOpen={true} onClose={vi.fn()} />);
      expect(screen.queryByText("Hacer una oferta")).not.toBeInTheDocument();
    });

    it("NO se renderiza cuando isOpen=false", () => {
      render(<OfferModal listing={MOCK_LISTING_EPIC} isOpen={false} onClose={vi.fn()} />);
      expect(screen.queryByText("Hacer una oferta")).not.toBeInTheDocument();
    });
  });

  describe("filtrado de cartas elegibles", () => {
    it("filtra cartas con puntos insuficientes (rare 4pts < epic listing 8pts)", () => {
      render(<OfferModal listing={MOCK_LISTING_EPIC} isOpen={true} onClose={vi.fn()} />);
      // "BTS Jin Rare" tiene 4 pts, la carta listada requiere 8 pts → no debe aparecer
      expect(screen.queryByAltText("BTS Jin Rare")).not.toBeInTheDocument();
    });

    it("filtra cartas sin available_quantity (locked_quantity = quantity)", () => {
      render(<OfferModal listing={MOCK_LISTING_EPIC} isOpen={true} onClose={vi.fn()} />);
      // "BTS V Legendary" tiene available=0 → no debe aparecer aunque tenga 16pts
      expect(screen.queryByAltText("BTS V Legendary")).not.toBeInTheDocument();
    });

    it("muestra cartas con puntos suficientes Y disponibles", () => {
      render(<OfferModal listing={MOCK_LISTING_EPIC} isOpen={true} onClose={vi.fn()} />);
      // "TWICE Dahyun Epic" tiene 8 pts y available=2 → debe aparecer
      expect(screen.getByAltText("TWICE Dahyun Epic")).toBeInTheDocument();
    });

    it("con listing common (1pt), muestra todas las cartas disponibles", () => {
      render(<OfferModal listing={MOCK_LISTING_COMMON} isOpen={true} onClose={vi.fn()} />);
      // rare (4pts >= 1pt) y epic (8pts >= 1pt) deben aparecer
      expect(screen.getByAltText("TWICE Dahyun Epic")).toBeInTheDocument();
      expect(screen.getByAltText("BTS Jin Rare")).toBeInTheDocument();
      // unavailable (locked) sigue sin aparecer
      expect(screen.queryByAltText("BTS V Legendary")).not.toBeInTheDocument();
    });

    it("muestra mensaje cuando no hay cartas elegibles", () => {
      // Listing legendary (16pts) — solo la unavailable tendría 16pts pero está locked
      const legendaryListing: MarketListing & { cards: Card } = {
        ...MOCK_LISTING_EPIC,
        cards: { ...MOCK_LISTING_EPIC.cards, rarity: "legendary", rarity_points: 16 },
      };
      render(<OfferModal listing={legendaryListing} isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByText(/No tenés cartas con suficientes puntos disponibles/)).toBeInTheDocument();
    });
  });

  describe("selección de carta y puntos", () => {
    it("muestra los puntos de la carta seleccionada en el comparador", async () => {
      render(<OfferModal listing={MOCK_LISTING_EPIC} isOpen={true} onClose={vi.fn()} />);

      // Clickear la carta epic disponible
      const epicCardBtn = screen.getByAltText("TWICE Dahyun Epic").closest("button")!;
      fireEvent.click(epicCardBtn);

      // Debe mostrar "Tu carta:" con los puntos en el comparador
      expect(screen.getByText(/Tu carta:/)).toBeInTheDocument();
      // Verifica "OK" en el comparador (epic 8pts >= epic 8pts requeridos)
      expect(screen.getByText("OK")).toBeInTheDocument();
    });

    it("muestra los puntos requeridos del listing", () => {
      render(<OfferModal listing={MOCK_LISTING_EPIC} isOpen={true} onClose={vi.fn()} />);
      // El texto "al menos" con los pts requeridos aparece en el párrafo de requisito
      expect(screen.getByText(/al menos/)).toBeInTheDocument();
      // Verificamos que el elemento strong con los puntos requeridos existe
      const reqText = screen.getByText(/Necesitás ofrecer una carta de al menos/);
      expect(reqText).toBeInTheDocument();
    });
  });

  describe("cierre del modal", () => {
    it("llama onClose al hacer click en ✕", () => {
      const onClose = vi.fn();
      render(<OfferModal listing={MOCK_LISTING_EPIC} isOpen={true} onClose={onClose} />);
      fireEvent.click(screen.getByLabelText("Cerrar"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("confirmar oferta", () => {
    it("llama useCreateOffer.mutateAsync con la carta seleccionada", async () => {
      mockMutateAsync.mockResolvedValue({ offer: {} });

      render(<OfferModal listing={MOCK_LISTING_EPIC} isOpen={true} onClose={vi.fn()} />);

      // Seleccionar la carta epic
      const epicCardBtn = screen.getByAltText("TWICE Dahyun Epic").closest("button")!;
      fireEvent.click(epicCardBtn);

      const confirmBtn = screen.getByRole("button", { name: /Confirmar oferta/i });

      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(mockMutateAsync).toHaveBeenCalledWith({
        listingId: "listing-1",
        offered_card_id: "epic-card-id",
      });
    });

    it("el botón de confirmar está deshabilitado sin carta seleccionada", () => {
      render(<OfferModal listing={MOCK_LISTING_EPIC} isOpen={true} onClose={vi.fn()} />);
      const confirmBtn = screen.getByRole("button", { name: /Confirmar oferta/i });
      expect(confirmBtn).toBeDisabled();
    });

    it("el botón está deshabilitado cuando isPending=true", () => {
      (mockCreateOffer as { isPending: boolean }).isPending = true;

      render(<OfferModal listing={MOCK_LISTING_EPIC} isOpen={true} onClose={vi.fn()} />);
      const confirmBtn = screen.getByRole("button", { name: /Enviando/i });
      expect(confirmBtn).toBeDisabled();
    });
  });
});
