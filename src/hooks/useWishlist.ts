import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { WishlistItem } from "@/types";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Retorna la wishlist del usuario autenticado.
 * Incluye join con cards (definición de fotocard).
 *
 * queryKey: ["wishlist"]
 * staleTime: 30s
 */
export function useWishlist() {
  return useQuery<WishlistItem[]>({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const res = await fetch("/api/wishlist");

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to fetch wishlist" }));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to fetch wishlist"
        );
      }

      const data = (await res.json()) as { items: WishlistItem[] };
      return data.items;
    },
    staleTime: 30_000,
  });
}

/**
 * Hook auxiliar: determina si una carta está en la wishlist del usuario.
 * Lee directamente del cache de useWishlist() sin hacer fetch adicional.
 * Devuelve false si el cache aún no está cargado.
 */
export function useIsInWishlist(cardDefinitionId: string): boolean {
  const queryClient = useQueryClient();
  const cached = queryClient.getQueryData<WishlistItem[]>(["wishlist"]);
  if (!cached) return false;
  return cached.some((item) => item.card_definition_id === cardDefinitionId);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Toggle wishlist: agrega la carta si no está, la quita si ya está.
 * Determina el método (POST/DELETE) consultando el cache de ["wishlist"].
 *
 * Optimistic update:
 *   - Al agregar: inserta un item provisional en el cache.
 *   - Al quitar: remueve el item del cache.
 * Rollback en caso de error.
 *
 * onSuccess: invalida ["wishlist"] para refrescar desde servidor.
 */
interface WishlistContext {
  previousWishlist: WishlistItem[] | undefined;
}

/**
 * Variables de useToggleWishlist.
 * `isInWishlist` debe ser pasado por el caller para evitar race conditions
 * entre onMutate (que aplica el optimistic update antes de mutationFn) y
 * la lectura del cache en mutationFn.
 *
 * Uso recomendado:
 *   const isIn = useIsInWishlist(cardId);
 *   toggleWishlist.mutate({ cardDefinitionId: cardId, isInWishlist: isIn });
 *
 * Si `isInWishlist` no se provee, el hook lo infiere del cache en el momento
 * de llamar a mutate (puede ser incorrecto si onMutate ya modificó el cache).
 */
export interface ToggleWishlistVars {
  cardDefinitionId: string;
  isInWishlist?: boolean;
}

export function useToggleWishlist() {
  const queryClient = useQueryClient();

  return useMutation<
    { ok?: boolean; item?: WishlistItem },
    Error,
    ToggleWishlistVars,
    WishlistContext
  >({
    mutationFn: async ({ cardDefinitionId, isInWishlist }) => {
      // Si no se pasó isInWishlist explícitamente, inferir del cache.
      // NOTA: en este punto onMutate ya puede haber modificado el cache,
      // por eso se recomienda siempre pasar isInWishlist desde el caller.
      const shouldRemove = isInWishlist ?? false;

      if (shouldRemove) {
        // Quitar de wishlist
        const res = await fetch(`/api/wishlist/${cardDefinitionId}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Failed to remove from wishlist" }));
          throw new Error(
            (body as { error?: string }).error ?? "Failed to remove from wishlist"
          );
        }

        return res.json() as Promise<{ ok: boolean }>;
      } else {
        // Agregar a wishlist
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card_definition_id: cardDefinitionId }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Failed to add to wishlist" }));
          throw new Error(
            (body as { error?: string }).error ?? "Failed to add to wishlist"
          );
        }

        return res.json() as Promise<{ item: WishlistItem }>;
      }
    },

    onMutate: async ({ cardDefinitionId }) => {
      await queryClient.cancelQueries({ queryKey: ["wishlist"] });

      const previousWishlist = queryClient.getQueryData<WishlistItem[]>(["wishlist"]);
      const currentCache = previousWishlist ?? [];
      const isInWishlist = currentCache.some(
        (item) => item.card_definition_id === cardDefinitionId
      );

      if (isInWishlist) {
        // Optimistic remove
        queryClient.setQueryData<WishlistItem[]>(["wishlist"], (old) =>
          (old ?? []).filter((item) => item.card_definition_id !== cardDefinitionId)
        );
      } else {
        // Optimistic add — creamos un item provisional
        const optimisticItem: WishlistItem = {
          user_id: "", // desconocido en el cliente, el servidor lo tendrá
          card_definition_id: cardDefinitionId,
          created_at: new Date().toISOString(),
        };
        queryClient.setQueryData<WishlistItem[]>(["wishlist"], (old) => [
          ...(old ?? []),
          optimisticItem,
        ]);
      }

      return { previousWishlist };
    },

    onError: (_err, _payload, context) => {
      // Rollback del optimistic update
      if (context?.previousWishlist !== undefined) {
        queryClient.setQueryData(["wishlist"], context.previousWishlist);
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });
}
