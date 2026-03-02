/* ------------------------------------------------------------------ */
/*  Database types - mirrors the Supabase Postgres schema              */
/* ------------------------------------------------------------------ */

export type Gender = 'male' | 'female' | 'other';
export type AttractedTo = 'men' | 'women' | 'all';
export type LookingFor = 'serious' | 'casual' | 'friends' | 'figuring_out';
export type EventType = 'wedding' | 'party' | 'corporate' | 'meetup' | 'other';
export type EventStatus = 'draft' | 'active' | 'paused' | 'ended' | 'archived';
export type MessageType = 'text' | 'image' | 'system';
export type NotificationType = 'like_received' | 'new_message';
export type MessageChannel = 'sms' | 'whatsapp' | 'email';
export type MessagePurpose =
  | 'otp' | 'pre_event' | 'welcome' | 'feedback'
  | 'upload_reminder_7d' | 'upload_reminder_3d'
  | 'upload_instructions' | 'event_summary'
  | 'addon_invoice' | 'custom_reminder';
export type WaCategory = 'authentication' | 'marketing' | 'utility';
export type MessageLogStatus = 'sent' | 'delivered' | 'failed' | 'read';

/* ---------- Payment types ---------- */

export type PaymentStatus =
  | 'not_applicable'
  | 'pending_payment'
  | 'payment_link_sent'
  | 'paid'
  | 'waived'
  | 'expired';

export type PaymentMethod = 'bit' | 'paybox' | 'cash' | 'bank_transfer' | 'other';

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
  wa_messages_enabled: boolean;
  guest_list_uploaded: boolean;
  guest_list_uploaded_at: string | null;
  guest_list_count: number;
  original_slug: string | null;
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
  phone: string | null;
  sms_consent: boolean;
  feedback_sent: boolean;
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

export interface OtpVerification {
  id: string;
  phone: string;
  event_id: string;
  code: string;
  attempts: number;
  is_used: boolean;
  expires_at: string;
  created_at: string;
}

export interface EventGuestPhone {
  id: string;
  event_id: string;
  phone: string;
  guest_name: string | null;
  wa_pre_event_sent: boolean;
  wa_pre_event_sent_at: string | null;
  wa_marketing_window_opened_at: string | null;
  created_at: string;
}

export interface MessageLog {
  id: string;
  event_id: string;
  phone: string | null;
  channel: MessageChannel;
  message_type: MessagePurpose;
  wa_category: WaCategory | null;
  status: MessageLogStatus;
  provider_message_id: string | null;
  error_message: string | null;
  recipient_email: string | null;
  created_at: string;
}

export interface ClientPortalToken {
  id: string;
  event_id: string;
  token: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface DiscountClaim {
  id: string;
  phone: string;
  discount_code: string;
  event_name: string;
  event_date: string;
  event_id: string | null;
  wa_message_id: string | null;
  is_redeemed: boolean;
  redeemed_at: string | null;
  created_at: string;
}

export interface EventRequest {
  id: string;
  status: 'pending' | 'approved' | 'denied';
  event_type: string;
  event_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  wants_custom_background: boolean;
  background_base64: string | null;
  poster_choice: string | null;
  selected_template_id: string | null;
  special_requests: string | null;
  wants_guest_messages: boolean;
  contact_preference: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  admin_notes: string | null;
  approved_event_id: string | null;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  total_price: number;
  payment_link_token: string | null;
  payment_link_expires_at: string | null;
  created_at: string;
  reviewed_at: string | null;
}

/** Payment-specific fields from EventRequest (for UI components). */
export interface EventRequestPayment {
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  total_price: number;
  payment_link_token: string | null;
  payment_link_expires_at: string | null;
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
      otp_verifications: { Row: OtpVerification; Insert: Omit<OtpVerification, 'id' | 'created_at'>; Update: Partial<OtpVerification>; Relationships: [] };
      event_guest_phones: { Row: EventGuestPhone; Insert: Omit<EventGuestPhone, 'id' | 'created_at'>; Update: Partial<EventGuestPhone>; Relationships: [] };
      message_log: { Row: MessageLog; Insert: Omit<MessageLog, 'id' | 'created_at'>; Update: Partial<MessageLog>; Relationships: [] };
      client_portal_tokens: { Row: ClientPortalToken; Insert: Omit<ClientPortalToken, 'id' | 'created_at'>; Update: Partial<ClientPortalToken>; Relationships: [] };
      discount_claims: { Row: DiscountClaim; Insert: Omit<DiscountClaim, 'id' | 'created_at'>; Update: Partial<DiscountClaim>; Relationships: [] };
      event_requests: { Row: EventRequest; Insert: Omit<EventRequest, 'id' | 'created_at'>; Update: Partial<EventRequest>; Relationships: [] };
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
