import { RARITY_POINTS } from "@/types";
import type { CardRarity } from "@/types";

/**
 * Valida si una carta ofrecida tiene suficientes puntos de rareza
 * para intercambiarse por la carta listada.
 *
 * Regla: rarity_points(offered) >= rarity_points(listed)
 */
export function hasEnoughPoints(
  offeredRarity: CardRarity,
  listedRarity: CardRarity
): boolean {
  return RARITY_POINTS[offeredRarity] >= RARITY_POINTS[listedRarity];
}

/**
 * Valida si una carta tiene unidades disponibles para ofertar o listar.
 *
 * available_quantity = quantity - locked_quantity
 */
export function hasAvailableQuantity(
  quantity: number,
  lockedQuantity: number
): boolean {
  return quantity - lockedQuantity >= 1;
}

/**
 * Calcula la cantidad disponible de una carta.
 * Nunca retorna un valor negativo (invariante de DB).
 */
export function availableQuantity(quantity: number, lockedQuantity: number): number {
  return Math.max(0, quantity - lockedQuantity);
}
