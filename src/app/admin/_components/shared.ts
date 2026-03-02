/* ─── Admin shared types, helpers, and styles ─── */

import type { PaymentStatus, PaymentMethod } from '@/lib/database.types';

/* ---------- Re-export payment types for convenience ---------- */
export type { PaymentStatus, PaymentMethod };

/* ---------- Analytics ---------- */

export interface EventAnalytics {
  // === Registration ===
  incompleteRegistrations: number;   // joined but never set up profile

  // === Participants (complete profiles only) ===
  totalParticipants: number;
  totalMen: number;
  totalWomen: number;
  menAttractedToMen: number;
  menAttractedToWomen: number;
  menAttractedToAll: number;
  womenAttractedToMen: number;
  womenAttractedToWomen: number;
  womenAttractedToAll: number;
  ageDistribution: { range: string; count: number }[];
  participantsWithPhotos: number;
  totalPhotosUploaded: number;
  avgPhotosPerParticipant: number;

  // === Likes ===
  totalLikes: number;
  likeSentByMen: number;
  likeSentByWomen: number;
  firstLikeByGender: { men: number; women: number };
  likesSeenCount: number;
  likesUnseenCount: number;
  avgLikesPerParticipant: number;

  // === Matches ===
  totalMatches: number;
  matchRate: number;                  // matches / unique like pairs %
  matchesToConversation: number;      // matches that opened a conversation
  deadMatches: number;                // matches with no conversation

  // === Conversations ===
  totalConversations: number;
  firstMessageByMen: number;
  firstMessageByWomen: number;
  totalMessages: number;
  textMessages: number;
  imageMessages: number;
  avgMessagesPerConversation: number;
  activeConversations: number;        // conversations with 2+ messages
  oneMessageConversations: number;    // conversations with only 1 message

  // === Funnel ===
  funnel: {
    joined: number;
    setupProfile: number;             // has display_name set
    sentFirstLike: number;
    gotMatch: number;
    sentFirstMessage: number;
    activeChatter: number;            // sent 3+ messages
  };

  // === Timing ===
  avgTimeToFirstLikeMinutes: number;  // avg time from join to first like
  avgTimeToFirstMessageMinutes: number; // avg time from match to first message

  // === Blocks ===
  totalBlocks: number;
  blocksByMen: number;
  blocksByWomen: number;
  blocksAfterConversation: number;
  blocksAfterLike: number;
  blocksWithNoInteraction: number;

  // === Usage Timeline ===
  usageTimeline: {
    timestamp: string;
    totalOnline: number;
    menOnline: number;
    womenOnline: number;
  }[];

  // === Usage by gender + attraction ===
  usageByGenderAttraction: {
    group: string;
    avgInteractions: number;
  }[];

  // === Peak Activity ===
  peakActivityHour: string;
  peakActivityCount: number;

  // === Response & Ghost Metrics ===
  responseRate: number;
  avgResponseTimeMinutes: number;
  ghostRate: number;
  ghostedConversations: number;

  // === Most Popular (anonymized top 3) ===
  mostPopular: { rank: number; likesReceived: number; matchCount: number }[];

  // === Funnel Timing ===
  funnelTiming: {
    avgJoinToFirstLikeMinutes: number;
    avgFirstLikeToMatchMinutes: number;
    avgMatchToFirstMessageMinutes: number;
  };

  // === Mutual Attraction Heatmap ===
  mutualAttractionMatrix: { fromGroup: string; toGroup: string; matches: number }[];

  // === Block After Match ===
  blockAfterMatchRate: number;
  blockAfterMatchCount: number;

  // === Photo Impact ===
  photoImpact: {
    avgLikesWithPhoto: number;
    avgLikesWithoutPhoto: number;
  };
}

/* ---------- Global Analytics ---------- */

export interface GlobalAnalytics {
  // ═══ Overview ═══
  totalEvents: number;
  activeEvents: number;
  archivedEvents: number;
  eventsByStatus: Record<string, number>;
  eventsByType: Record<string, number>;

  // ═══ Registration ═══
  incompleteRegistrations: number;   // joined but never set up profile (all-time)

  // ═══ Participants (complete profiles only, all-time including archived) ═══
  totalParticipants: number;
  totalMen: number;
  totalWomen: number;
  avgParticipantsPerEvent: number;
  avgMenPct: number;
  avgWomenPct: number;

  // ═══ Engagement totals (all-time) ═══
  totalLikes: number;
  totalMatches: number;
  totalConversations: number;
  totalMessages: number;
  totalBlocks: number;
  totalPhotos: number;

  // ═══ Global rates (aggregated) ═══
  overallMatchRate: number;
  overallGhostRate: number;
  overallResponseRate: number;
  overallLikeSeenRate: number;
  overallBlockRate: number;
  overallPhotoRate: number;
  photoImpactDelta: number; // avg diff: likes with vs without photo

  // ═══ Cross-event averages ═══
  avgLikesPerEvent: number;
  avgMatchesPerEvent: number;
  avgConversationsPerEvent: number;
  avgMessagesPerEvent: number;
  avgBlocksPerEvent: number;
  avgMatchRatePerEvent: number;

  // ═══ Global timing (averaged across events) ═══
  avgTimeToFirstLikeMinutes: number;
  avgTimeToFirstMessageMinutes: number;
  avgResponseTimeMinutes: number;

  // ═══ Funnel (aggregated across all events) ═══
  funnel: {
    joined: number;
    setupProfile: number;
    sentFirstLike: number;
    gotMatch: number;
    sentFirstMessage: number;
    activeChatter: number;
  };

  // ═══ Top events rankings (top 5) ═══
  topEventsByParticipants: EventRankItem[];
  topEventsByLikes: EventRankItem[];
  topEventsByMessages: EventRankItem[];
  topEventsByMatchRate: EventRankItem[];
  topEventsByEngagement: EventRankItem[];

  // ═══ Per-event comparison table ═══
  eventComparison: EventComparisonRow[];

  // ═══ Growth timelines ═══
  eventsCreatedByMonth: { month: string; count: number }[];
  participantsJoinedByMonth: { month: string; count: number }[];
  engagementByMonth: { month: string; likes: number; matches: number; messages: number }[];

  // ═══ Gender + Attraction global breakdown ═══
  attractionBreakdown: { label: string; count: number }[];

  // ═══ Age distribution (global) ═══
  ageDistribution: { range: string; count: number }[];

  // ═══ Peak hours (across all events) ═══
  peakHours: { hour: string; count: number }[];

  // ═══ Message type breakdown ═══
  messageTypes: { type: string; count: number }[];

  // ═══ Block reasons (global) ═══
  blockReasons: { reason: string; count: number }[];
}

export interface EventRankItem {
  eventId: string;
  name: string;
  eventType: string;
  value: number;
  label?: string;
}

export interface EventComparisonRow {
  eventId: string;
  name: string;
  eventType: string;
  status: string;
  participants: number;
  likes: number;
  matches: number;
  matchRate: number;
  conversations: number;
  messages: number;
  blocks: number;
}

/* ---------- Simple stats (backward compat) ---------- */

export interface EventStats {
  participants: number;
  conversations: number;
  likes: number;
  messages: number;
  blocks: number;
}

export interface AdminParticipant {
  id: string;
  display_name: string;
  gender: string;
  age: number | null;
  is_banned: boolean;
  created_at: string;
  profile_complete?: boolean;
  // ─── Messaging fields ───
  phone: string | null;           // masked: "050-***-4567"
  sms_consent: boolean;
  feedback_sent: boolean;
  join_source: 'pre_event_link' | 'qr_on_spot';
}

/**
 * Fetch wrapper that includes credentials and sets JSON Content-Type
 * unless the body is FormData (multipart upload).
 */
export const adminFetch = (url: string, init?: RequestInit) => {
  const isFormData = init?.body instanceof FormData;
  return fetch(url, {
    ...init,
    credentials: 'include',
    headers: isFormData ? undefined : { ...init?.headers, 'Content-Type': 'application/json' },
  });
};

/* ---------- Event Requests ---------- */

export interface EventRequest {
  id: string;
  status: 'pending' | 'approved' | 'denied';
  event_type: string;
  event_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  wants_custom_background: boolean;
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
  // Payment fields
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  total_price: number;
  payment_link_token: string | null;
  payment_link_expires_at: string | null;
  created_at: string;
  reviewed_at: string | null;
}

/** Generate a URL-safe slug from a string. */
export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/* ---------- Messaging & Guest Phone Management ---------- */

export interface EventMessagingStatus {
  waMessagesEnabled: boolean;
  preEventSendAt: string | null;   // ISO timestamp when pre-event messages fire
  feedbackSendAt: string | null;   // ISO timestamp when feedback messages fire
  preEventSentCount: number;
  feedbackSentCount: number;
  totalGuestPhones: number;
  portalTokenActive: boolean;
  portalToken: string | null;
}

export interface GuestPhoneAdmin {
  id: string;
  phone: string;            // full phone (admin can see unmasked)
  name: string | null;
  source: 'file' | 'manual' | 'portal';
  normalizedPhone: string;
  waPreEventSent: boolean;
  waFeedbackSent: boolean;
  createdAt: string;
}

export interface MessageLogEntry {
  id: string;
  phoneId: string;
  channel: 'whatsapp' | 'sms' | 'email';
  messageType: 'pre_event' | 'feedback' | 'reminder' | 'custom';
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt: string;
  errorMessage: string | null;
}

export interface MessagingConfig {
  waMessagesEnabled: boolean;
  preEventHoursBefore: number;
  feedbackHoursAfter: number;
}

/** High-level messaging overview for the admin dashboard. */
export interface MessagingOverview {
  totalEvents: number;
  eventsWithMessaging: number;
  totalGuestPhones: number;
  totalMessagesSent: number;
  totalDelivered: number;
  totalFailed: number;
  channelBreakdown: {
    sms: number;
    whatsapp: number;
    email: number;
  };
}

/** Payment status display config (Hebrew label, emoji, CSS color class). */
export const PAYMENT_STATUS_DISPLAY: Record<string, { label: string; emoji: string; color: string }> = {
  not_applicable: { label: 'לא רלוונטי', emoji: '➖', color: 'admin-badge--muted' },
  pending_payment: { label: 'ממתין לתשלום', emoji: '⏳', color: 'admin-badge--draft' },
  payment_link_sent: { label: 'קישור נשלח', emoji: '📧', color: 'admin-badge--draft' },
  paid: { label: 'שולם', emoji: '✅', color: 'admin-badge--active' },
  waived: { label: 'בוטל/הנחה', emoji: '🎁', color: 'admin-badge--ended' },
  expired: { label: 'פג תוקף', emoji: '⏰', color: 'admin-badge--ended' },
};

/** Payment method labels in Hebrew. */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bit: 'Bit',
  paybox: 'PayBox',
  cash: 'מזומן',
  bank_transfer: 'העברה בנקאית',
  other: 'אחר',
};
