'use client';

/** Navigation view the sidebar can switch between. */
export type AdminView = 'dashboard' | 'events' | 'requests' | 'moderation' | 'analytics';

interface SidebarProps {
  activeView: AdminView;
  onNavigate: (view: AdminView) => void;
  totalEvents: number;
  pendingRequestsCount: number;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS: { key: AdminView; icon: string; label: string }[] = [
  { key: 'dashboard',  icon: '🏠', label: 'לוח בקרה' },
  { key: 'events',     icon: '🎉', label: 'אירועים' },
  { key: 'requests',   icon: '📩', label: 'בקשות' },
  { key: 'moderation', icon: '🛡️', label: 'מתינות' },
  { key: 'analytics',  icon: '📊', label: 'אנליטיקס' },
];

export default function Sidebar({
  activeView, onNavigate, totalEvents, pendingRequestsCount, onLogout, isOpen, onClose,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`admin-sidebar-overlay ${isOpen ? 'admin-sidebar-overlay--open' : ''}`}
        onClick={onClose}
        role="presentation"
      />

      <aside className={`admin-sidebar ${isOpen ? 'admin-sidebar--open' : ''}`}>
        {/* Logo */}
        <div className="admin-sidebar__logo">
          <div className="admin-sidebar__logo-name">Eventa Admin</div>
          <div className="admin-sidebar__logo-sub">מערכת ניהול אירועים</div>
        </div>

        {/* Navigation */}
        <nav className="admin-sidebar__nav" aria-label="ניווט ראשי">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              className={`admin-sidebar__nav-item ${activeView === item.key ? 'admin-sidebar__nav-item--active' : ''}`}
              onClick={() => { onNavigate(item.key); onClose(); }}
              aria-current={activeView === item.key ? 'page' : undefined}
            >
              <span className="admin-sidebar__nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}

              {/* Counts / badges */}
              {item.key === 'events' && (
                <span className="admin-sidebar__nav-count">{totalEvents}</span>
              )}
              {item.key === 'requests' && pendingRequestsCount > 0 && (
                <span className="admin-sidebar__badge">{pendingRequestsCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="admin-sidebar__footer">
          <button
            className="admin-btn admin-btn--ghost"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={onLogout}
          >
            <span aria-hidden="true">↩</span>
            התנתק
          </button>
        </div>
      </aside>
    </>
  );
}
