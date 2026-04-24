import { describe, it, expect } from "vitest";
import { hasEnoughPoints, hasAvailableQuantity, availableQuantity } from "@/lib/trading";

describe("hasEnoughPoints — validación de puntos de rareza", () => {
  describe("casos válidos (debe pasar)", () => {
    it("epic (8 pts) >= rare (4 pts) → válida", () => {
      expect(hasEnoughPoints("epic", "rare")).toBe(true);
    });

    it("legendary (16 pts) >= legendary (16 pts) → válida (mismo nivel)", () => {
      expect(hasEnoughPoints("legendary", "legendary")).toBe(true);
    });

    it("legendary (16 pts) >= epic (8 pts) → válida", () => {
      expect(hasEnoughPoints("legendary", "epic")).toBe(true);
    });

    it("legendary (16 pts) >= rare (4 pts) → válida", () => {
      expect(hasEnoughPoints("legendary", "rare")).toBe(true);
    });

    it("legendary (16 pts) >= common (1 pt) → válida", () => {
      expect(hasEnoughPoints("legendary", "common")).toBe(true);
    });

    it("epic (8 pts) >= epic (8 pts) → válida (mismo nivel)", () => {
      expect(hasEnoughPoints("epic", "epic")).toBe(true);
    });

    it("epic (8 pts) >= common (1 pt) → válida", () => {
      expect(hasEnoughPoints("epic", "common")).toBe(true);
    });

    it("rare (4 pts) >= rare (4 pts) → válida (mismo nivel)", () => {
      expect(hasEnoughPoints("rare", "rare")).toBe(true);
    });

    it("rare (4 pts) >= common (1 pt) → válida", () => {
      expect(hasEnoughPoints("rare", "common")).toBe(true);
    });

    it("common (1 pt) >= common (1 pt) → válida (mismo nivel)", () => {
      expect(hasEnoughPoints("common", "common")).toBe(true);
    });
  });

  describe("casos inválidos (debe fallar)", () => {
    it("rare (4 pts) >= epic (8 pts) → inválida", () => {
      expect(hasEnoughPoints("rare", "epic")).toBe(false);
    });

    it("common (1 pt) >= legendary (16 pts) → inválida", () => {
      expect(hasEnoughPoints("common", "legendary")).toBe(false);
    });

    it("common (1 pt) >= rare (4 pts) → inválida", () => {
      expect(hasEnoughPoints("common", "rare")).toBe(false);
    });

    it("common (1 pt) >= epic (8 pts) → inválida", () => {
      expect(hasEnoughPoints("common", "epic")).toBe(false);
    });

    it("rare (4 pts) >= legendary (16 pts) → inválida", () => {
      expect(hasEnoughPoints("rare", "legendary")).toBe(false);
    });

    it("epic (8 pts) >= legendary (16 pts) → inválida", () => {
      expect(hasEnoughPoints("epic", "legendary")).toBe(false);
    });
  });
});

describe("hasAvailableQuantity — disponibilidad de cartas", () => {
  it("quantity=3, locked=0 → disponible (3 libres)", () => {
    expect(hasAvailableQuantity(3, 0)).toBe(true);
  });

  it("quantity=1, locked=0 → disponible (1 libre)", () => {
    expect(hasAvailableQuantity(1, 0)).toBe(true);
  });

  it("quantity=2, locked=1 → disponible (1 libre)", () => {
    expect(hasAvailableQuantity(2, 1)).toBe(true);
  });

  it("quantity=1, locked=1 → NO disponible (0 libres)", () => {
    expect(hasAvailableQuantity(1, 1)).toBe(false);
  });

  it("quantity=3, locked=3 → NO disponible (0 libres)", () => {
    expect(hasAvailableQuantity(3, 3)).toBe(false);
  });

  it("quantity=0, locked=0 → NO disponible", () => {
    expect(hasAvailableQuantity(0, 0)).toBe(false);
  });
});

describe("availableQuantity — cálculo de cantidad disponible", () => {
  it("quantity=3, locked=1 → available=2", () => {
    expect(availableQuantity(3, 1)).toBe(2);
  });

  it("quantity=1, locked=0 → available=1", () => {
    expect(availableQuantity(1, 0)).toBe(1);
  });

  it("quantity=1, locked=1 → available=0", () => {
    expect(availableQuantity(1, 1)).toBe(0);
  });

  it("nunca retorna negativo (invariante de DB)", () => {
    // quantity=0, locked=0 → 0, no negativo
    expect(availableQuantity(0, 0)).toBe(0);
  });
});

describe("RARITY_POINTS — consistencia de valores", () => {
  it("tiene exactamente 4 niveles de rareza", async () => {
    const { RARITY_POINTS } = await import("@/types");
    expect(Object.keys(RARITY_POINTS)).toHaveLength(4);
  });

  it("common = 1 pt", async () => {
    const { RARITY_POINTS } = await import("@/types");
    expect(RARITY_POINTS.common).toBe(1);
  });

  it("rare = 4 pts", async () => {
    const { RARITY_POINTS } = await import("@/types");
    expect(RARITY_POINTS.rare).toBe(4);
  });

  it("epic = 8 pts", async () => {
    const { RARITY_POINTS } = await import("@/types");
    expect(RARITY_POINTS.epic).toBe(8);
  });

  it("legendary = 16 pts", async () => {
    const { RARITY_POINTS } = await import("@/types");
    expect(RARITY_POINTS.legendary).toBe(16);
  });

  it("los puntos son estrictamente ascendentes: common < rare < epic < legendary", async () => {
    const { RARITY_POINTS } = await import("@/types");
    expect(RARITY_POINTS.common).toBeLessThan(RARITY_POINTS.rare);
    expect(RARITY_POINTS.rare).toBeLessThan(RARITY_POINTS.epic);
    expect(RARITY_POINTS.epic).toBeLessThan(RARITY_POINTS.legendary);
  });
});
