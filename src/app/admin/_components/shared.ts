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

/* ---------- Event Feedback ---------- */

export interface FeedbackResponse {
  id: string;
  createdAt: string;
  enjoyment: number;
  easeOfUse: number;
  usageLevel: 'view_only' | 'likes' | 'matches' | 'chat';
  interactionResult: 'messages' | 'real_life' | 'interesting' | 'none';
  favoriteFeatures: string[];
  improvementText: string | null;
  recommendation: number;
  successStory: 'yes' | 'maybe' | 'no' | null;
  successStoryText: string | null;
  allowStoryPublish: boolean;
}

export interface FeedbackAggregates {
  enjoymentAvg: number;
  easeOfUseAvg: number;
  recommendationAvg: number;
  enjoymentDist: Record<number, number>;
  recommendationDist: Record<number, number>;
  usageLevels: Record<string, number>;
  interactionResults: Record<string, number>;
  featureFrequency: Record<string, number>;
  successStories: Record<string, number>;
  improvementCount: number;
  successStoryTexts: { text: string; allowPublish: boolean; createdAt: string }[];
}

export interface FeedbackData {
  slug: string;
  totalResponses: number;
  aggregates: FeedbackAggregates;
  responses: FeedbackResponse[];
}

/** Hebrew labels for feedback fields */
export const USAGE_LEVEL_LABELS: Record<string, string> = {
  view_only: 'רק צפייה',
  likes: 'לייקים',
  matches: 'התאמות',
  chat: "צ'אט",
};

export const INTERACTION_RESULT_LABELS: Record<string, string> = {
  messages: 'הודעות',
  real_life: 'מפגש במציאות',
  interesting: 'היה מעניין',
  none: 'ללא',
};

export const FEATURE_LABELS: Record<string, string> = {
  swipes: '👆 סוויפים',
  chat: "💬 צ'אט",
  see_likes: '❤️ לייקים',
  design: '🎨 עיצוב',
  concept: '💡 קונספט',
  vibe: '✨ אווירה',
  nothing: '🚫 כלום',
};

export const ENJOYMENT_EMOJIS: Record<number, string> = { 1: '😐', 2: '🙂', 3: '😃', 4: '🤩' };
export const RECOMMENDATION_EMOJIS: Record<number, string> = { 1: '👎', 2: '🤷', 3: '👍', 4: '🔥' };
export const SUCCESS_STORY_LABELS: Record<string, string> = { yes: '✅ כן', maybe: '🤔 אולי', no: '❌ לא' };

/** Payment status display config (Hebrew label, emoji, CSS color class). */
export const PAYMENT_STATUS_DISPLAY: Record<string, { label: string; emoji: string; color: string }> = {
  not_applicable: { label: 'לא רלוונטי', emoji: '➖', color: 'admin-badge--muted' },
  pending_payment: { label: 'ממתין לתשלום', emoji: '⏳', color: 'admin-badge--draft' },
  payment_link_sent: { label: 'קישור נשלח', emoji: '📧', color: 'admin-badge--draft' },
  awaiting_payment: { label: 'ממתין לכרטיס', emoji: '💳', color: 'admin-badge--draft' },
  card_captured: { label: 'כרטיס נשמר', emoji: '🔒', color: 'admin-badge--paused' },
  paid: { label: 'שולם', emoji: '✅', color: 'admin-badge--active' },
  waived: { label: 'בוטל/הנחה', emoji: '🎁', color: 'admin-badge--ended' },
  expired: { label: 'פג תוקף', emoji: '⏰', color: 'admin-badge--ended' },
  charge_failed: { label: 'חיוב נכשל', emoji: '❌', color: 'admin-badge--ended' },
};

/** Payment method labels in Hebrew. */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bit: 'Bit',
  paybox: 'PayBox',
  cash: 'מזומן',
  bank_transfer: 'העברה בנקאית',
  credit_card: 'כרטיס אשראי',
  other: 'אחר',
};

/* ---------- Invoice / Payments Tab Types ---------- */

/** Invoice4U Document type enum (mirrors server-side) */
export const DOCUMENT_TYPES = {
  1: 'חשבונית',
  2: 'קבלה',
  3: 'חשבונית מס / קבלה',
  4: 'חשבונית זיכוי',
  5: 'חשבונית עסקה',
  6: 'הזמנת עבודה',
  7: 'הצעת מחיר',
  8: 'תעודת משלוח',
  9: 'קבלה על חשבון',
} as const;

/** Types commonly generated in Eventa */
export const COMMON_DOC_TYPES = [
  { value: 3, label: 'חשבונית מס / קבלה', emoji: '🧾' },
  { value: 1, label: 'חשבונית', emoji: '📄' },
  { value: 2, label: 'קבלה', emoji: '🧾' },
  { value: 5, label: 'חשבונית עסקה', emoji: '📋' },
  { value: 7, label: 'הצעת מחיר', emoji: '📝' },
] as const;

/** Invoice4U payment types for receipts */
export const INVOICE4U_PAYMENT_TYPES = [
  { value: 4, label: 'מזומן' },
  { value: 3, label: 'העברה בנקאית' },
  { value: 8, label: 'Bit' },
  { value: 9, label: 'PayBox' },
  { value: 1, label: 'כרטיס אשראי' },
  { value: 2, label: 'צ׳ק' },
  { value: 7, label: 'אחר' },
] as const;

/** Local invoice record (from our DB) */
export interface LocalInvoice {
  id: string;
  event_request_id: string | null;
  invoice4u_doc_id: string;
  invoice4u_doc_number: string | null;
  invoice4u_doc_type: number;
  invoice4u_customer_id: number | null;
  invoice4u_doc_url: string | null;
  doc_type_label: string;
  customer_name: string | null;
  customer_email: string | null;
  total_amount: number;
  vat_amount: number;
  currency: string;
  status: 'active' | 'cancelled';
  issued_at: string;
  created_at: string;
  original_invoice_id: string | null;
}

/** Payment summary from the API */
export interface PaymentSummaryData {
  totalRevenue: number;
  pendingRevenue: number;
  totalRequests: number;
  statusCounts: Record<string, number>;
  methodCounts: Record<string, number>;
  invoiceCount: number;
  recentInvoices: LocalInvoice[];
  invoice4uConfigured: boolean;
}

/** Format ILS currency */
export function formatILS(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
