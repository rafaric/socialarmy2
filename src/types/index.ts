export interface Profile {
  id: string;
  name: string;
  avatar: string;
  cover?: string;
  about?: string;
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
}

export interface Like {
  id: string;
  post_id: string;
  user_id: string;
}

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
  profiles?: Profile;
}

export interface SavedPost {
  post_id: string;
}
