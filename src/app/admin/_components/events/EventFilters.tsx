'use client';

import { EVENT_STATUS_LABELS, EVENT_TYPE_OPTIONS, EVENT_TYPE_ICONS } from '@/lib/constants';
import type { EventStatus, EventType } from '@/lib/database.types';

/** Status tabs with the "all" pseudo-status. */
export type StatusTab = 'all' | EventStatus;

interface EventFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusTab: StatusTab;
  onStatusTabChange: (tab: StatusTab) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  statusCounts: Record<string, number>;
  totalCount: number;
}

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'הכל' },
  { key: 'active', label: EVENT_STATUS_LABELS.active },
  { key: 'draft', label: EVENT_STATUS_LABELS.draft },
  { key: 'paused', label: EVENT_STATUS_LABELS.paused },
  { key: 'ended', label: EVENT_STATUS_LABELS.ended },
  { key: 'archived', label: EVENT_STATUS_LABELS.archived },
];

export default function EventFilters({
  search, onSearchChange, statusTab, onStatusTabChange,
  typeFilter, onTypeFilterChange, statusCounts, totalCount,
}: EventFiltersProps) {
  return (
    <div className="admin-animate-in">
      {/* Status tabs */}
      <div className="admin-tabs">
        {TABS.map(tab => {
          const count = tab.key === 'all' ? totalCount : (statusCounts[tab.key] || 0);
          return (
            <button
              key={tab.key}
              className={`admin-tab ${statusTab === tab.key ? 'admin-tab--active' : ''}`}
              onClick={() => onStatusTabChange(tab.key)}
            >
              {tab.label}
              <span className="admin-tab__count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search + type filter */}
      <div className="admin-filters">
        <div className="admin-filters__search">
          <input
            className="admin-input"
            placeholder="🔍 חיפוש לפי שם או slug..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <select
          className="admin-select"
          value={typeFilter}
          onChange={e => onTypeFilterChange(e.target.value)}
        >
          <option value="">כל הסוגים</option>
          {EVENT_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {EVENT_TYPE_ICONS[opt.value]} {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
