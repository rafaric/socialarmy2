export interface Profile {
  id: string;
  name: string;
  avatar: string;
  cover?: string;
  about?: string;
  army_since?: string | null;
  bias?: string | null;
  bias_wrecker?: string | null;
  bts_husband?: string | null;
  fav_song?: string | null;
  fav_album?: string | null;
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
}

export type ReactionType = "heart" | "fire" | "magic" | "cry";

export interface Like {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: ReactionType;
}

export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "heart", emoji: "💜", label: "Love" },
  { type: "fire",  emoji: "🔥", label: "Fire" },
  { type: "magic", emoji: "✨", label: "Magic" },
  { type: "cry",   emoji: "😭", label: "Feels" },
];

export interface Comment {
  id: string;
  content: string;
  created_at: string;
  author: string;
  parent: string;
  profiles: Profile;
}

export type NotificationType = "like" | "comentario" | "post";

export interface Notification {
  id: string;
  notification_type: NotificationType;
  user_emisor: string;
  user_receptor: string;
  post_id: string | null;
  created_at: string;
  read: boolean;
  profiles?: Profile;
}

export interface SavedPost {
  post_id: string;
}
