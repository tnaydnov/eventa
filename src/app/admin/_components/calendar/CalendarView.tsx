'use client';

import { useState, useMemo, useCallback } from 'react';
import type { Event } from '@/lib/database.types';
import { EVENT_TYPE_ICONS, EVENT_STATUS_LABELS } from '@/lib/constants';

/** Hebrew day names (Sunday-first, Israeli-standard). */
const HEBREW_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const statusDotColor: Record<string, string> = {
  active: '#22c55e',
  draft: '#a3a3a3',
  paused: '#f59e0b',
  ended: '#6366f1',
  archived: '#78716c',
};

interface CalendarViewProps {
  events: Event[];
  onViewEvent: (event: Event) => void;
}

/** Get all calendar cells for a month grid (may include trailing/leading days). */
function getMonthGrid(year: number, month: number) {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay(); // 0=Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: { date: number; inMonth: boolean; key: string }[] = [];

  // Leading empty cells (days from previous month)
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ date: prevMonthDays - i, inMonth: false, key: `p${prevMonthDays - i}` });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: d, inMonth: true, key: `c${d}` });
  }

  // Trailing cells to complete the last week
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: d, inMonth: false, key: `n${d}` });
    }
  }

  return cells;
}

export default function CalendarView({ events, onViewEvent }: CalendarViewProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  /** Group events by the LOCAL date they START on (YYYY-MM-DD). */
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const ev of events) {
      const d = new Date(ev.starts_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const arr = map.get(key);
      if (arr) arr.push(ev);
      else map.set(key, [ev]);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goToday = useCallback(() => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }, [today]);

  const prevMonth = useCallback(() => {
    setViewMonth(m => {
      if (m === 0) { setViewYear(y => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth(m => {
      if (m === 11) { setViewYear(y => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  /** How many events to show per cell before "+N more" */
  const MAX_VISIBLE = 3;

  return (
    <div className="cal-root admin-animate-in" dir="rtl">
      {/* Header */}
      <div className="admin-topbar">
        <h2 className="admin-topbar__title">📅 לוח שנה</h2>
      </div>

      {/* Navigation */}
      <div className="cal-nav">
        <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={prevMonth}>→</button>
        <h3 className="cal-nav__title">
          {HEBREW_MONTHS[viewMonth]} {viewYear}
        </h3>
        <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={nextMonth}>←</button>
        <button className="admin-btn admin-btn--sm admin-btn--ghost cal-nav__today" onClick={goToday}>
          היום
        </button>
      </div>

      {/* Calendar grid */}
      <div className="cal-grid">
        {/* Day headers */}
        {HEBREW_DAYS.map(d => (
          <div key={d} className="cal-day-header">{d}</div>
        ))}

        {/* Day cells */}
        {cells.map(cell => {
          const dateKey = cell.inMonth
            ? `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(cell.date).padStart(2, '0')}`
            : '';
          const dayEvents = (cell.inMonth && eventsByDate.get(dateKey)) || [];
          const isToday = dateKey === todayStr;
          const isFriday = cells.indexOf(cell) % 7 === 5;
          const isSaturday = cells.indexOf(cell) % 7 === 6;
          const isWeekend = isFriday || isSaturday;

          return (
            <div
              key={cell.key}
              className={[
                'cal-cell',
                !cell.inMonth && 'cal-cell--outside',
                isToday && 'cal-cell--today',
                isWeekend && 'cal-cell--weekend',
              ].filter(Boolean).join(' ')}
            >
              <span className={`cal-cell__date ${isToday ? 'cal-cell__date--today' : ''}`}>
                {cell.date}
              </span>
              <div className="cal-cell__events">
                {dayEvents.slice(0, MAX_VISIBLE).map(ev => (
                  <button
                    key={ev.id}
                    className="cal-event-chip"
                    onClick={() => onViewEvent(ev)}
                    title={`${ev.name} (${EVENT_STATUS_LABELS[ev.status] || ev.status})`}
                  >
                    <span
                      className="cal-event-chip__dot"
                      style={{ background: statusDotColor[ev.status] || '#a3a3a3' }}
                    />
                    <span className="cal-event-chip__icon">
                      {EVENT_TYPE_ICONS[ev.event_type] || '📌'}
                    </span>
                    <span className="cal-event-chip__name">{ev.name}</span>
                  </button>
                ))}
                {dayEvents.length > MAX_VISIBLE && (
                  <span className="cal-cell__more">
                    +{dayEvents.length - MAX_VISIBLE} נוספים
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="cal-legend">
        {Object.entries(statusDotColor).map(([status, color]) => (
          <span key={status} className="cal-legend__item">
            <span className="cal-legend__dot" style={{ background: color }} />
            {EVENT_STATUS_LABELS[status] || status}
          </span>
        ))}
      </div>
    </div>
  );
}
