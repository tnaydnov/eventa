/**
 * Messaging module barrel export.
 * Import everything from '@/lib/messaging' instead of individual files.
 */

// Types
export type {
  MessageChannel,
  MessagePurpose,
  WaCategory,
  SendResult,
  EventMessagingConfig,
  SendSmsParams,
  SendSmsResult,
  WaTemplateParam,
  WaTemplateComponent,
  SendWaTemplateParams,
  SendWaResult,
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
  WA_TEMPLATES,
  preEventVars,
  welcomeVars,
  feedbackVars,
} from './templates';

// Providers (low-level - prefer using the messaging service)
export { sendSms } from './sms-provider';
export { sendWhatsAppTemplate } from './whatsapp-provider';

// High-level messaging service
export {
  sendOtp,
  sendPreEventMessage,
  sendWelcomeMessage,
  sendFeedbackMessage,
} from './messaging-service';
