'use client';

import { EVENT_STATUS_LABELS } from '@/lib/constants';
import type { EventStatus } from '@/lib/database.types';

/** Navigation view the sidebar can switch between. */
export type AdminView = 'events' | 'global-analytics';

interface SidebarProps {
  activeView: AdminView;
  onNavigate: (view: AdminView) => void;
  eventCounts: Record<string, number>;
  totalEvents: number;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

/** Status tabs shown in sidebar with counts. */
const STATUS_NAV: { key: string; icon: string; label: string }[] = [
  { key: 'all',      icon: '📋', label: 'כל האירועים' },
  { key: 'active',   icon: '🟢', label: EVENT_STATUS_LABELS.active },
  { key: 'draft',    icon: '📝', label: EVENT_STATUS_LABELS.draft },
  { key: 'paused',   icon: '⏸️', label: EVENT_STATUS_LABELS.paused },
  { key: 'ended',    icon: '🏁', label: EVENT_STATUS_LABELS.ended },
  { key: 'archived', icon: '🗄️', label: EVENT_STATUS_LABELS.archived },
];

export default function Sidebar({
  activeView, onNavigate, eventCounts, totalEvents, onLogout, isOpen, onClose,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`admin-sidebar-overlay ${isOpen ? 'admin-sidebar-overlay--open' : ''}`}
        onClick={onClose}
      />

      <aside className={`admin-sidebar ${isOpen ? 'admin-sidebar--open' : ''}`}>
        {/* Brand */}
        <div className="admin-sidebar__brand">
          <div>
            <div className="admin-sidebar__brand-text">💒 Weddate</div>
            <div className="admin-sidebar__brand-sub">ניהול אירועים</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="admin-sidebar__nav">
          <button
            className={`admin-sidebar__nav-item ${activeView === 'events' ? 'admin-sidebar__nav-item--active' : ''}`}
            onClick={() => { onNavigate('events'); onClose(); }}
          >
            <span className="admin-sidebar__nav-icon">📋</span>
            אירועים
            <span style={{ marginRight: 'auto', fontSize: '12px', opacity: 0.7 }}>{totalEvents}</span>
          </button>

          <button
            className={`admin-sidebar__nav-item ${activeView === 'global-analytics' ? 'admin-sidebar__nav-item--active' : ''}`}
            onClick={() => { onNavigate('global-analytics'); onClose(); }}
          >
            <span className="admin-sidebar__nav-icon">📊</span>
            אנליטיקס כללי
          </button>
        </nav>

        {/* Quick stats */}
        <div className="admin-sidebar__stats">
          {STATUS_NAV.map(s => {
            const count = s.key === 'all' ? totalEvents : (eventCounts[s.key] || 0);
            if (s.key !== 'all' && count === 0) return null;
            return (
              <div key={s.key} className="admin-sidebar__stat-row">
                <span className="admin-sidebar__stat-label">{s.icon} {s.label}</span>
                <span className="admin-sidebar__stat-value">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="admin-sidebar__footer">
          <button className="admin-btn admin-btn--ghost" style={{ width: '100%' }} onClick={onLogout}>
            התנתק
          </button>
        </div>
      </aside>
    </>
  );
}
