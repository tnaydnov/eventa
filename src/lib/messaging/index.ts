/**
 * Messaging module barrel export.
 * Import everything from '@/lib/messaging' instead of individual files.
 */

// Types
export type {
  MessageChannel,
  MessagePurpose,
  SendResult,
  EventMessagingConfig,
  SendSmsParams,
  SendSmsResult,
} from './types';

// Phone utilities
export {
  normalizePhone,
  isValidIsraeliMobile,
  formatPhoneDisplay,
  maskPhone,
} from './phone-utils';

// Templates
export {
  buildJoinUrl,
  buildFeedbackUrl,
  otpSmsText,
  preEventSmsText,
  welcomeSmsText,
  feedbackSmsText,
} from './templates';

// Provider (low-level - prefer using the messaging service)
export { sendSms } from './sms-provider';

// High-level messaging service
export {
  sendOtp,
  sendPreEventMessage,
  sendWelcomeMessage,
  sendFeedbackMessage,
} from './messaging-service';
