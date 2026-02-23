'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSessionStore, useNotificationStore } from '@/lib/store';

const GRID_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const CHAT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const HEART_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
);

export default function TabBar() {
  const pathname = usePathname();
  const session = useSessionStore((s) => s.session);
  const unreadLikes = useNotificationStore((s) => s.unreadLikes);
  const unreadMessages = useNotificationStore((s) => s.unreadMessages);

  if (!session) return null;

  const basePath = `/dating/${session.eventSlug}`;

  const tabs = [
    { path: basePath, label: 'גריד', icon: GRID_ICON, badge: 0 },
    { path: `${basePath}/chats`, label: 'צ׳אטים', icon: CHAT_ICON, badge: unreadMessages },
    { path: `${basePath}/likes`, label: 'לייקים', icon: HEART_ICON, badge: unreadLikes },
  ];

  return (
    <nav className="tab-bar" aria-label="ניווט ראשי">
      {tabs.map((tab) => (
        <Link
          key={tab.path}
          href={tab.path}
          prefetch={true}
          className={pathname === tab.path ? 'active' : ''}
          aria-label={tab.label}
          aria-current={pathname === tab.path ? 'page' : undefined}
          style={{ position: 'relative' }}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.badge > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '2px',
                right: '50%',
                transform: 'translateX(14px)',
                background: 'var(--primary)',
                color: 'white',
                borderRadius: '10px',
                minWidth: '18px',
                height: '18px',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              {tab.badge > 9 ? '9+' : tab.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
