export interface Profile {
  id: string;
  name: string;
  avatar: string;
  cover?: string;
  about?: string;
  army_since?: string | null;
  bias?: string | null;
  bias_wrecker?: string | null;
  fav_song?: string | null;
  fav_album?: string | null;
  is_admin?: boolean;
  searchable?: boolean;
  is_private?: boolean;
}

export interface Photo {
  id: string;
  tipo: string;
  url: string;
}

export interface TaggedFriend {
  label: string;
  value: string;
}

export interface Post {
  id: string;
  content: string;
  created_at: string;
  author: string;
  photos: Photo[] | null;
  tagged: TaggedFriend[] | null;
  profiles: Profile;
  parent?: string | null;
  era?: string | null;
  now_playing?: string | null;
  bts_members?: string[] | null;
  poll?: Poll | null;
  sticker_url?: string | null;
  source_url?: string | null;
  source_label?: string | null;
}

export type ReactionType =
  | "heart"
  | "fire"
  | "magic"
  | "cry"
  | "soft"
  | "star"
  | "hug"
  | "music"
  | "mind_blown"
  | "crown";

export interface Like {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: ReactionType;
}

export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "heart",      emoji: "💜", label: "Love"       },
  { type: "fire",       emoji: "🔥", label: "Fire"       },
  { type: "magic",      emoji: "✨", label: "Magic"      },
  { type: "cry",        emoji: "😭", label: "Feels"      },
  { type: "soft",       emoji: "🥹", label: "Soft"       },
  { type: "star",       emoji: "🌟", label: "Star"       },
  { type: "hug",        emoji: "🫶", label: "Purple you" },
  { type: "music",      emoji: "🎵", label: "Music"      },
  { type: "mind_blown", emoji: "🤯", label: "OMG"        },
  { type: "crown",      emoji: "👑", label: "King/Queen" },
];

export interface Comment {
  id: string;
  content: string;
  created_at: string;
  author: string;
  parent: string;
  sticker_url?: string | null;
  profiles: Profile;
}

export interface Sticker {
  id: string;
  uploaded_by: string | null;
  url: string;
  name: string | null;
  created_at: string;
}

export interface Poll {
  question: string;
  options: string[];
  ends_at: string; // ISO datetime
}

export interface PollVote {
  id: string;
  post_id: string;
  user_id: string;
  option_index: number;
  created_at: string;
}

export type NotificationType =
  | "like"
  | "comentario"
  | "post"
  | "friend_request"
  | "friend_accept"
  | "poll_vote"
  | "poll_ended"
  // Trading system:
  | "trade_offer_received"
  | "trade_offer_accepted"
  | "trade_offer_rejected"
  | "wishlist_card_listed"
  | "listing_expired"
  | "trade_match_suggested";

export interface Notification {
  id: string;
  notification_type: NotificationType;
  user_emisor: string | null;
  user_receptor: string;
  post_id: string | null;
  reference_id?: string | null;
  reference_type?: "listing" | "offer" | null;
  created_at: string;
  read: boolean;
  profiles?: Profile;
}

export interface SavedPost {
  post_id: string;
}

// Payload y respuestas de /api/friends/request
export type FriendRequestPayload = { friend_id: string };
// Nota: la tabla friends usa clave compuesta (sin id autogenerado), por eso ok: true
export type FriendRequestResponse = { ok: boolean };
export type FriendRequestConflict = { error: string; status: "pending" | "accepted" };

// Respuesta de /api/uploads/validate
export type UploadValidateResponse =
  | { valid: true; mime: string }
  | { error: string };

// ---------------------------------------------------------------------------
// Trading System
// ---------------------------------------------------------------------------

export type CardRarity = "common" | "rare" | "epic" | "legendary";

export type ListingStatus = "active" | "completed" | "expired" | "cancelled";
export type OfferStatus = "pending" | "accepted" | "rejected" | "cancelled";

export const RARITY_POINTS: Record<CardRarity, number> = {
  common: 1,
  rare: 4,
  epic: 8,
  legendary: 16,
};

/** Definición de una fotocard (tabla `cards`). */
export interface Card {
  id: string;
  name: string;
  member: string | null;
  era: string | null;
  rarity: CardRarity;
  rarity_points: number;
  image_url: string;
}

/** Entrada del inventario del usuario (tabla `user_cards` — modelo stacked). */
export interface UserCard {
  user_id: string;
  card_definition_id: string;
  quantity: number;
  locked_quantity: number;
  first_obtained_at: string;
  updated_at: string;
  cards?: Card;
}

export interface MarketListing {
  id: string;
  seller_id: string;
  card_definition_id: string;
  auto_accept: boolean;
  status: ListingStatus;
  expires_at: string;
  created_at: string;
  completed_at: string | null;
  cards?: Card;
  seller?: Profile;
}

export interface TradeOffer {
  id: string;
  listing_id: string;
  buyer_id: string;
  offered_card_id: string;
  status: OfferStatus;
  created_at: string;
  resolved_at: string | null;
  offered_card?: Card;
  buyer?: Profile;
}

export interface TradeHistory {
  id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  listed_card_id: string;
  offered_card_id: string;
  completed_at: string;
  listed_card?: Card;
  offered_card?: Card;
  seller?: Profile;
  buyer?: Profile;
}

export interface WishlistItem {
  user_id: string;
  card_definition_id: string;
  created_at: string;
  cards?: Card;
}

// ---------------------------------------------------------------------------
// Payloads de API — Trading
// ---------------------------------------------------------------------------

export type CreateListingPayload = { card_definition_id: string; auto_accept: boolean };
export type CreateOfferPayload = { offered_card_id: string };

export type ListingsQuery = {
  rarity?: CardRarity;
  cursor?: string;
  limit?: number;
};

export type TradeApiError = {
  error: string;
  detail?: string;
};
