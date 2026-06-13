/**
 * API barrel - re-exports all client-side API functions.
 * Import from '@/lib/api' continues to work via the facade in ../api.ts.
 */
export { getPhotoUrl } from './helpers';
export { joinEvent, sendOtp, verifyOtp } from './auth';
export { updateProfile, getParticipant, getMyParticipant } from './profile';
export { uploadPhoto, deletePhoto, reorderPhotos, getMyPhotos, getParticipantPhotos } from './photos';
export { getGridParticipants, matchesCrossAttraction } from './grid';
export {
  sendLike,
  removeLike,
  getReceivedLikes,
  getSentLikes,
  getSentLikeIds,
  hasLiked,
  markLikeSeen,
  markAllLikesSeen,
  getUnseenLikes,
} from './likes';
export {
  getConversationById,
  getOrCreateConversation,
  getConversations,
  getMessages,
  getMessagesBefore,
  sendMessage,
  deleteMessage,
  uploadChatImage,
  markConversationRead,
  getUnreadConversations,
} from './conversations';
export { blockParticipant } from './blocks';
export { getBlockedIds } from './helpers';
export {
  getMatches,
} from './matches';
export { deleteAccount } from './account';
export {
  getPortalData,
  uploadGuestFile,
  addGuestPhone,
  removeGuestPhone,
  recordGuestConsent,
  getTemplateDownloadUrl,
} from './guest-portal';
export type {
  PortalData,
  PortalGuest,
  UploadResult,
  MutationResult,
} from './guest-portal';
export { fetchWithRetry } from './fetch-retry';
export type { FetchRetryOptions } from './fetch-retry';
export { getNotificationDeltas } from './deltas';
export type { NotificationDeltas, DeltaLike, DeltaMessage } from './deltas';
