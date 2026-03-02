/**
 * API barrel - re-exports all client-side API functions.
 * Import from '@/lib/api' continues to work via the facade in ../api.ts.
 */
export { getPhotoUrl } from './helpers';
export { joinEvent, sendOtp, verifyOtp } from './auth';
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
export { deleteAccount } from './account';
export {
  getPortalData,
  uploadGuestFile,
  addGuestPhone,
  removeGuestPhone,
  getTemplateDownloadUrl,
} from './guest-portal';
export type {
  PortalData,
  PortalGuest,
  UploadResult,
  AddPhoneResult,
} from './guest-portal';
