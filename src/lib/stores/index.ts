/**
 * Barrel re-export for all Zustand stores.
 * Import from '@/lib/stores' or '@/lib/store' (facade).
 */
export { useSessionStore, type WeddingSession } from './session';
export { useGridStore, type GridParticipant } from './grid';
export { useChatsStore, type ConversationWithDetails } from './chats';
export { useLikesStore } from './likes';
export { useBlocksStore } from './blocks';
export { useToastStore } from './toast';
export { useNotificationStore, type GridHighlight } from './notifications';
export { useSwipeStore } from './swipe';
export { useMatchStore, type MatchedParticipant, type MatchEntry } from './matches';
