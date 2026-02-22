'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { adminFetch, type AdminParticipant } from '../shared';

/* ─── Types ─── */

type SortField = 'display_name' | 'gender' | 'age' | 'created_at' | 'is_banned';
type SortDir = 'asc' | 'desc';
type GenderFilter = 'all' | 'male' | 'female';

interface ParticipantsTableProps {
  eventId: string;
  /** If true, the event is archived and ban actions are hidden. */
  isArchived?: boolean;
}

/* ─── Helpers ─── */

const genderLabel = (g: string) =>
  g === 'male' ? '👨 גבר' : g === 'female' ? '👩 אישה' : g;

const shortDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
};

const SORT_ICONS: Record<SortDir, string> = { asc: '↑', desc: '↓' };

/* ─── Component ─── */

export default function ParticipantsTable({ eventId, isArchived }: ParticipantsTableProps) {
  const [participants, setParticipants] = useState<AdminParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* Filters */
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');

  /* Sorting */
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  /* ─── Fetch participants ─── */
  const fetchParticipants = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch(`/api/admin/events/${eventId}/participants`);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
      } else {
        setError('שגיאה בטעינת משתתפים');
      }
    } catch {
      setError('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchParticipants(); }, [fetchParticipants]);

  /* ─── Ban / unban ─── */
  const [confirmTarget, setConfirmTarget] = useState<AdminParticipant | null>(null);

  const handleBanClick = (p: AdminParticipant) => {
    if (p.is_banned) {
      // Unban - no confirmation needed
      executeBan(p.id, true);
    } else {
      // Ban - show confirmation
      setConfirmTarget(p);
    }
  };

  const executeBan = async (pid: string, currentlyBanned: boolean) => {
    const res = await adminFetch(`/api/admin/events/${eventId}/participants`, {
      method: 'PATCH',
      body: JSON.stringify({ participantId: pid, is_banned: !currentlyBanned }),
    });
    if (res.ok) {
      setParticipants(prev =>
        prev.map(p => p.id === pid ? { ...p, is_banned: !currentlyBanned } : p)
      );
    } else {
      alert('שגיאה בעדכון חסימה');
    }
  };

  /* ─── Sort handler ─── */
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'display_name' ? 'asc' : 'desc');
    }
  };

  /* ─── Filter + sort ─── */
  const filtered = useMemo(() => {
    let result = participants;

    // Gender filter
    if (genderFilter !== 'all') {
      result = result.filter(p => p.gender === genderFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(p =>
        (p.display_name || '').toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'display_name':
          cmp = (a.display_name || '').localeCompare(b.display_name || '', 'he');
          break;
        case 'gender':
          cmp = a.gender.localeCompare(b.gender);
          break;
        case 'age':
          cmp = (a.age ?? 0) - (b.age ?? 0);
          break;
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'is_banned':
          cmp = (a.is_banned ? 1 : 0) - (b.is_banned ? 1 : 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [participants, genderFilter, search, sortField, sortDir]);

  /* ─── Counts (only count profile-complete participants) ─── */
  const complete = participants.filter((p: any) => p.profile_complete !== false);
  const incomplete = participants.filter((p: any) => p.profile_complete === false);
  const totalMen = complete.filter(p => p.gender === 'male').length;
  const totalWomen = complete.filter(p => p.gender === 'female').length;
  const totalBanned = participants.filter(p => p.is_banned).length;

  /* ─── Column header helper ─── */
  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="pt-th pt-th--sortable"
      onClick={() => toggleSort(field)}
    >
      {label}
      {sortField === field && (
        <span className="pt-sort-icon">{SORT_ICONS[sortDir]}</span>
      )}
    </th>
  );

  return (
    <div className="ea-section">
      <h3 className="ea-section__title">👥 משתתפים</h3>

      {/* ─── Toolbar ─── */}
      <div className="pt-toolbar">
        <div className="pt-toolbar__right">
          <input
            className="admin-input pt-search"
            type="text"
            placeholder="🔍 חיפוש שם..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="pt-gender-tabs">
            <button
              className={`pt-gender-tab ${genderFilter === 'all' ? 'pt-gender-tab--active' : ''}`}
              onClick={() => setGenderFilter('all')}
            >
              הכל ({complete.length})
            </button>
            <button
              className={`pt-gender-tab ${genderFilter === 'male' ? 'pt-gender-tab--active' : ''}`}
              onClick={() => setGenderFilter('male')}
            >
              👨 ({totalMen})
            </button>
            <button
              className={`pt-gender-tab ${genderFilter === 'female' ? 'pt-gender-tab--active' : ''}`}
              onClick={() => setGenderFilter('female')}
            >
              👩 ({totalWomen})
            </button>
          </div>
        </div>
        <div className="pt-toolbar__left">
          {incomplete.length > 0 && (
            <span className="pt-banned-count" style={{ color: '#ff9800' }}>⚠️ {incomplete.length} לא השלימו פרופיל</span>
          )}
          {totalBanned > 0 && (
            <span className="pt-banned-count">🚫 {totalBanned} חסומים</span>
          )}
          <button className="admin-btn admin-btn--sm admin-btn--ghost" onClick={fetchParticipants}>
            🔄 רענן
          </button>
        </div>
      </div>

      {/* ─── Loading ─── */}
      {loading && (
        <div>
          {[1, 2, 3].map(i => (
            <div key={i} className="admin-skeleton admin-skeleton--line" style={{ height: 40 }} />
          ))}
        </div>
      )}

      {/* ─── Error ─── */}
      {error && <div className="ced-error">{error}</div>}

      {/* ─── Table ─── */}
      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="admin-empty" style={{ padding: '30px 20px' }}>
              <div className="admin-empty__icon">
                {participants.length === 0 ? '👥' : '🔍'}
              </div>
              <p className="admin-empty__text">
                {participants.length === 0
                  ? 'אין משתתפים עדיין'
                  : 'לא נמצאו משתתפים תואמים'}
              </p>
            </div>
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table">
                <thead>
                  <tr>
                    <SortHeader field="display_name" label="שם" />
                    <SortHeader field="gender" label="מגדר" />
                    <SortHeader field="age" label="גיל" />
                    <SortHeader field="created_at" label="הצטרפ/ה" />
                    <SortHeader field="is_banned" label="סטטוס" />
                    {!isArchived && <th className="pt-th">פעולות</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className={`pt-row ${p.is_banned ? 'pt-row--banned' : ''}`}>
                      <td className="pt-td pt-td--name" style={p.profile_complete === false ? { opacity: 0.5 } : undefined}>
                        {p.display_name || '(ללא שם)'}
                        {p.profile_complete === false && (
                          <span style={{ fontSize: '11px', color: '#ff9800', marginRight: '6px' }}>⚠️ לא השלים</span>
                        )}
                      </td>
                      <td className="pt-td">
                        {genderLabel(p.gender)}
                      </td>
                      <td className="pt-td">
                        {p.age ?? '-'}
                      </td>
                      <td className="pt-td pt-td--date">
                        {shortDate(p.created_at)}
                      </td>
                      <td className="pt-td">
                        {p.is_banned ? (
                          <span className="admin-badge admin-badge--ended">🚫 חסום</span>
                        ) : (
                          <span className="admin-badge admin-badge--active">פעיל</span>
                        )}
                      </td>
                      {!isArchived && (
                        <td className="pt-td">
                          <button
                            className={`admin-btn admin-btn--sm ${p.is_banned ? 'admin-btn--green' : 'admin-btn--red'}`}
                            onClick={() => handleBanClick(p)}
                          >
                            {p.is_banned ? '✅ בטל חסימה' : '🚫 חסום'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Result count */}
          {filtered.length > 0 && filtered.length !== participants.length && (
            <p className="pt-result-count">
              מציג {filtered.length} מתוך {participants.length}
            </p>
          )}
        </>
      )}

      {/* ── Ban confirmation popup ── */}
      {confirmTarget && (
        <div className="admin-overlay" onClick={() => setConfirmTarget(null)}>
          <div className="admin-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚫</div>
            <h3 className="admin-dialog__title" style={{ marginBottom: '8px' }}>
              חסימת {confirmTarget.display_name || 'משתתף/ת'}
            </h3>
            <p className="admin-text-muted" style={{ fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
              המשתתף/ת ייחסמו מהאירוע ולא יוכלו להיכנס מחדש.
              <br />
              פעולה זו ניתנת לביטול.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setConfirmTarget(null)}
                className="admin-btn admin-btn--ghost"
                style={{ flex: 1, padding: '10px' }}
              >
                ביטול
              </button>
              <button
                onClick={() => { executeBan(confirmTarget.id, confirmTarget.is_banned); setConfirmTarget(null); }}
                className="admin-btn admin-btn--red"
                style={{ flex: 1, padding: '10px' }}
              >
                🚫 חסום
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
