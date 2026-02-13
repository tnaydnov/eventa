/**
 * API barrel — re-exports all client-side API functions.
 * Import from '@/lib/api' continues to work via the facade in ../api.ts.
 */
export { getPhotoUrl } from './helpers';
export { joinEvent } from './auth';
export { updateProfile, getParticipant } from './profile';
export { uploadPhoto, deletePhoto, reorderPhotos, getMyPhotos } from './photos';
export { getGridParticipants } from './grid';
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
export {
  getMatches,
} from './matches';
export {
  closeCompass,
  checkCompassEligible,
  updateCompassLocation,
} from './compass';
export { deleteAccount } from './account';
