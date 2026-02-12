/* ─── Admin shared types, helpers, and styles ─── */

/* ---------- Analytics ---------- */

export interface EventAnalytics {
  // === Participants ===
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
  audioMessages: number;
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

  // === Compass ===
  compassRequestsSent: number;
  compassSessionsActivated: number;
  avgCompassDurationSeconds: number;

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

  // ═══ Participants (all-time including archived) ═══
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
  totalCompassSessions: number;
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
  avgCompassDurationSeconds: number;

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

/** Generate a URL-safe slug from a string. */
export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
