/**
 * Barrel re-export — all stores live in ./stores/ now.
 * This file is kept for backward-compatibility with existing imports.
 */
export {
  useSessionStore,
  type WeddingSession,
  useGridStore,
  type GridParticipant,
  useChatsStore,
  type ConversationWithDetails,
  useLikesStore,
  useBlocksStore,
  useToastStore,
  useNotificationStore,
  type GridHighlight,
  useSwipeStore,
  useMatchStore,
  type MatchedParticipant,
  type MatchEntry,
} from './stores';
