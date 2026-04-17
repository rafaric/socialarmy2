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

export type NotificationType = "like" | "comentario" | "post" | "friend_request" | "friend_accept" | "poll_vote" | "poll_ended";

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
