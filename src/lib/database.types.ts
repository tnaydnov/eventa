/* ------------------------------------------------------------------ */
/*  Database types - mirrors the Supabase Postgres schema              */
/* ------------------------------------------------------------------ */

export type Gender = 'male' | 'female' | 'other';
export type AttractedTo = 'men' | 'women' | 'all';
export type LookingFor = 'serious' | 'casual' | 'friends' | 'figuring_out';
export type EventType = 'wedding' | 'party' | 'brit' | 'bar_mitzvah' | 'corporate' | 'meetup' | 'other';
export type EventStatus = 'draft' | 'active' | 'paused' | 'ended' | 'archived';
export type MessageType = 'text' | 'image' | 'system';
export type NotificationType = 'like_received' | 'new_message';

/* ---------- Row types ---------- */

export interface Event {
  id: string;
  slug: string;
  name: string;
  join_code: string;
  event_type: EventType;
  status: EventStatus;
  description: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  background_image: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface Participant {
  id: string;
  event_id: string;
  device_fingerprint: string | null;
  hardware_fingerprint: string | null;
  display_name: string;
  gender: Gender;
  attracted_to: AttractedTo;
  bio: string | null;
  age: number;
  city: string | null;
  looking_for: LookingFor | null;
  is_banned: boolean;
  last_seen_at: string;
  created_at: string;
}

/** Participant without internal fingerprint fields - safe for client-side use. */
export type PublicParticipant = Omit<Participant, 'device_fingerprint' | 'hardware_fingerprint'>;

export interface ParticipantPhoto {
  id: string;
  event_id: string;
  participant_id: string;
  storage_path: string;
  order_index: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  event_id: string;
  a_participant_id: string;
  b_participant_id: string;
  created_at: string;
  last_message_at: string | null;
  a_last_read_at: string | null;
  b_last_read_at: string | null;
}

export interface Message {
  id: string;
  event_id: string;
  conversation_id: string;
  sender_participant_id: string;
  type: MessageType;
  text: string | null;
  media_path: string | null;
  is_deleted: boolean;
  created_at: string;
}

export interface Like {
  id: string;
  event_id: string;
  from_participant_id: string;
  to_participant_id: string;
  created_at: string;
  seen_at: string | null;
}

export interface Block {
  id: string;
  event_id: string;
  blocker_id: string;
  blocked_id: string;
  had_like: boolean;
  had_conversation: boolean;
  had_match: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  event_id: string;
  to_participant_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  created_at: string;
  is_read: boolean;
}

export interface BannedDevice {
  id: string;
  event_id: string;
  device_fingerprint: string;
  banned_at: string;
}

export interface ActivityLog {
  id: string;
  event_id: string;
  participant_id: string;
  action: string;
  created_at: string;
}

export interface EventAnalyticsSnapshot {
  id: string;
  event_id: string;
  snapshot: Record<string, unknown>;
  created_at: string;
}

/* ---------- Supabase Database helper (minimal) ---------- */

export interface Database {
  public: {
    Tables: {
      events: { Row: Event; Insert: Omit<Event, 'id' | 'created_at' | 'archived_at'>; Update: Partial<Event>; Relationships: [] };
      participants: { Row: Participant; Insert: Omit<Participant, 'id' | 'created_at' | 'last_seen_at'>; Update: Partial<Participant>; Relationships: [] };
      participant_photos: { Row: ParticipantPhoto; Insert: Omit<ParticipantPhoto, 'id' | 'created_at'>; Update: Partial<ParticipantPhoto>; Relationships: [] };
      conversations: { Row: Conversation; Insert: Omit<Conversation, 'id' | 'created_at' | 'last_message_at'>; Update: Partial<Conversation>; Relationships: [] };
      messages: { Row: Message; Insert: Omit<Message, 'id' | 'created_at'>; Update: Partial<Message>; Relationships: [] };
      likes: { Row: Like; Insert: Omit<Like, 'id' | 'created_at'>; Update: Partial<Like>; Relationships: [] };
      blocks: { Row: Block; Insert: Omit<Block, 'id' | 'created_at'>; Update: Partial<Block>; Relationships: [] };
      notifications: { Row: Notification; Insert: Omit<Notification, 'id' | 'created_at'>; Update: Partial<Notification>; Relationships: [] };
      banned_devices: { Row: BannedDevice; Insert: Omit<BannedDevice, 'id' | 'banned_at'>; Update: Partial<BannedDevice>; Relationships: [] };
      activity_log: { Row: ActivityLog; Insert: Omit<ActivityLog, 'id' | 'created_at'>; Update: Partial<ActivityLog>; Relationships: [] };
      event_analytics_snapshots: { Row: EventAnalyticsSnapshot; Insert: Omit<EventAnalyticsSnapshot, 'id' | 'created_at'>; Update: Partial<EventAnalyticsSnapshot>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      gender: Gender;
      attracted_to: AttractedTo;
      message_type: MessageType;
      notification_type: NotificationType;
    };
  };
}
