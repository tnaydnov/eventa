/**
 * Centralized route helpers.
 * All app route paths go through here to prevent hardcoded strings across the codebase.
 */

export const routes = {
  // Marketing / static
  home: () => '/',
  order: () => '/order',
  eventOver: () => '/event-over',
  howItWorks: () => '/how-it-works',
  pricing: () => '/pricing',
  faq: () => '/faq',

  // Client portal
  portal: (token: string) => `/portal/${token}`,
  portalReport: (token: string) => `/portal/${token}/report`,

  // Event pages
  event: (slug: string) => `/${slug}`,
  join: (slug: string, _code?: string) => `/${slug}/join`,
  setup: (slug: string) => `/${slug}/setup`,
  profile: (slug: string) => `/${slug}/profile`,
  feedback: (slug: string) => `/${slug}/feedback`,
  banned: (slug: string) => `/${slug}/banned`,
  unavailable: (slug: string, reason?: string) =>
    `/${slug}/unavailable${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`,
  user: (slug: string, userId: string) => `/${slug}/user/${userId}`,
  chat: (slug: string, convId: string) => `/${slug}/chat/${convId}`,
  chats: (slug: string) => `/${slug}/chats`,
  likes: (slug: string) => `/${slug}/likes`,
  swipe: (slug: string) => `/${slug}/swipe`,
} as const;
