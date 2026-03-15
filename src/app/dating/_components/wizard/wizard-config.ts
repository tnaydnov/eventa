/**
 * Wizard Configuration - Single source of truth for the order wizard.
 *
 * To add/remove an event type → add/remove one entry in WIZARD_TYPES.
 * Everything (labels, fields, templates, validation) cascades from here.
 */

// ─── Event Type Config ──────────────────────────────────────

export interface NameFieldConfig {
  /** Whether the name field is required for this event type */
  required: boolean;
  /** Hebrew label shown above the input */
  label: string;
  /** Placeholder text inside the input */
  placeholder: string;
  /** Optional hint shown below the input */
  hint?: string;
}

export interface WizardTypeConfig {
  /** DB key - e.g. 'wedding' */
  key: string;
  /** Hebrew label - e.g. 'חתונה' */
  label: string;
  /** Icon for the type card */
  icon: string;
  /** Short description for the card */
  description: string;
  /** Name field configuration (dynamic per type) */
  nameField: NameFieldConfig;
  /** Poster catalog folder key - maps to manifest.json types */
  posterCatalog: string;
  /** Default event duration in hours */
  defaultDurationHours: number;
  /** Whether guest messaging is supported for this type */
  supportsGuestMessages: boolean;
}

export const WIZARD_TYPES: WizardTypeConfig[] = [
  {
    key: 'wedding',
    label: 'חתונה',
    icon: 'rings',
    description: 'שכבת היכרויות לרווקים והרווקות באירוע',
    nameField: {
      required: true,
      label: 'שמות הזוג באנגלית',
      placeholder: 'Maya & Daniel',
      hint: 'יופיע בראש האפליקציה',
    },
    posterCatalog: 'wedding',
    defaultDurationHours: 6,
    supportsGuestMessages: true,
  },
  {
    key: 'party',
    label: 'מסיבה',
    icon: 'glass',
    description: 'מסיבה פרטית, מועדון, אירוע חברתי',
    nameField: {
      required: false,
      label: 'שם המסיבה (לא חובה)',
      placeholder: 'Summer Vibes 2026',
    },
    posterCatalog: 'party',
    defaultDurationHours: 5,
    supportsGuestMessages: true,
  },
  {
    key: 'meetup',
    label: 'מיטאפ',
    icon: 'people',
    description: 'מפגש נטוורקינג, קהילה, מיטאפ',
    nameField: {
      required: false,
      label: 'שם המיטאפ (לא חובה)',
      placeholder: 'React Meetup TLV',
    },
    posterCatalog: 'meetup',
    defaultDurationHours: 3,
    supportsGuestMessages: true,
  },
  {
    key: 'other',
    label: 'אחר',
    icon: 'sparkle',
    description: 'סוג אירוע אחר - ספרו לנו!',
    nameField: {
      required: false,
      label: 'שם האירוע (לא חובה)',
      placeholder: '',
    },
    posterCatalog: 'other',
    defaultDurationHours: 4,
    supportsGuestMessages: true,
  },
];

/** Quick lookup map by key */
export const WIZARD_TYPE_MAP = Object.fromEntries(
  WIZARD_TYPES.map(t => [t.key, t])
) as Record<string, WizardTypeConfig>;

// ─── Wizard Steps ───────────────────────────────────────────

export interface WizardStepMeta {
  id: string;
  label: string;
  icon: string;
}

export const WIZARD_STEPS: WizardStepMeta[] = [
  { id: 'type',       label: 'סוג אירוע',   icon: 'grid' },
  { id: 'details',    label: 'פרטים',       icon: 'calendar' },
  { id: 'background', label: 'רקע',         icon: 'palette' },
  { id: 'poster',     label: 'פוסטר',       icon: 'frame' },
  { id: 'messages',   label: 'הודעות',      icon: 'chat' },
  { id: 'summary',    label: 'סיכום',       icon: 'check' },
];

// ─── Wizard Form State ──────────────────────────────────────

export interface WizardFormState {
  // Step 1 - Type
  eventType: string;

  // Step 2 - Details
  eventName: string;
  startsAt: string;
  endsAt: string;

  // Step 3 - Background
  wantsCustomBackground: boolean;
  backgroundPreview: string | null;
  backgroundBase64: string | null;

  // Step 4 - Poster
  posterChoice: 'template' | 'qr-only';
  selectedTemplateId: string | null;
  specialRequests: string;

  // Step 5 - Messages
  wantsGuestMessages: boolean;

  // Step 6 - Summary / Contact
  contactPreference: 'call-me' | 'pay-now';
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

export const INITIAL_WIZARD_STATE: WizardFormState = {
  eventType: '',
  eventName: '',
  startsAt: '',
  endsAt: '',
  wantsCustomBackground: false,
  backgroundPreview: null,
  backgroundBase64: null,
  posterChoice: 'qr-only',
  selectedTemplateId: null,
  specialRequests: '',
  wantsGuestMessages: true,
  contactPreference: 'call-me',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
};

// ─── Poster Template Manifest Types ─────────────────────────

export interface PosterTemplate {
  id: string;
  file: string;
  label: string;
  /** Event types this template applies to. ['*'] = all types. */
  types: string[];
  /** Whether the poster has a name slot (requires event name) */
  hasNameSlot?: boolean;
}

export interface PosterManifest {
  templates: PosterTemplate[];
}

/** Filter templates for a given event type */
export function getTemplatesForType(
  templates: PosterTemplate[],
  eventType: string
): PosterTemplate[] {
  return templates.filter(
    t => t.types.includes('*') || t.types.includes(eventType)
  );
}
