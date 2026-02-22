'use client';

import { useState, useMemo } from 'react';
import type { Event } from '@/lib/database.types';
import EventFilters, { type StatusTab } from './EventFilters';
import EventRow from './EventCard';

interface EventsViewProps {
  events: Event[];
  loading: boolean;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onGenerateQR: (event: Event) => void;
  onCopyUrl: (event: Event) => void;
  onUploadBg: (eventId: string) => void;
  onRemoveBg: (eventId: string) => void;
  onViewDetails: (event: Event) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onCreateEvent: () => void;
}

export default function EventsView({
  events, loading,
  onRotate, onDelete,
  onGenerateQR, onCopyUrl,
  onUploadBg, onRemoveBg, onViewDetails, onUpdateStatus,
  onCreateEvent,
}: EventsViewProps) {
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [typeFilter, setTypeFilter] = useState('');

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.status] = (counts[e.status] || 0) + 1;
    }
    return counts;
  }, [events]);

  const filtered = useMemo(() => {
    let result = events;
    if (statusTab !== 'all') result = result.filter(e => e.status === statusTab);
    if (typeFilter) result = result.filter(e => e.event_type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q)
      );
    }
    return result;
  }, [events, statusTab, typeFilter, search]);

  return (
    <div>
      {/* Page header */}
      <div className="admin-topbar">
        <div>
          <h2 className="admin-topbar__title">אירועים</h2>
          <p className="admin-topbar__subtitle">ניהול אירועים, סטטיסטיקות ומשתתפים</p>
        </div>
        <button className="admin-btn admin-btn--primary" onClick={onCreateEvent}>
          ➕ אירוע חדש
        </button>
      </div>

      {/* Filters */}
      <EventFilters
        search={search}
        onSearchChange={setSearch}
        statusTab={statusTab}
        onStatusTabChange={setStatusTab}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        statusCounts={statusCounts}
        totalCount={events.length}
      />

      {/* Loading skeleton */}
      {loading && events.length === 0 && (
        <div>
          <div className="admin-skeleton" style={{ height: 48, marginBottom: 2 }} />
          <div className="admin-skeleton" style={{ height: 48, marginBottom: 2 }} />
          <div className="admin-skeleton" style={{ height: 48, marginBottom: 2 }} />
        </div>
      )}

      {/* Events table */}
      {filtered.length > 0 && (
        <div className="et-wrap admin-animate-in">
          <table className="et-table">
            <thead>
              <tr>
                <th className="et-th" style={{ width: 48 }}></th>
                <th className="et-th">שם</th>
                <th className="et-th">סטטוס</th>
                <th className="et-th et-th--hide-mobile">תאריכים</th>
                <th className="et-th" style={{ width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(event => (
                <EventRow
                  key={event.id}
                  event={event}
                  onViewDetails={onViewDetails}
                  onGenerateQR={onGenerateQR}
                  onCopyUrl={onCopyUrl}
                  onUploadBg={onUploadBg}
                  onRemoveBg={onRemoveBg}
                  onRotate={onRotate}
                  onUpdateStatus={onUpdateStatus}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="admin-empty">
          <div className="admin-empty__icon">
            {events.length === 0 ? '🎉' : '🔍'}
          </div>
          <p className="admin-empty__text">
            {events.length === 0
              ? 'עוד אין אירועים - צרו את הראשון!'
              : 'לא נמצאו אירועים לפי הסינון'}
          </p>
        </div>
      )}
    </div>
  );
}
