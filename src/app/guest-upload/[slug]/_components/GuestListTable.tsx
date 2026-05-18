'use client';

import { type ChangeEvent, useState, useCallback, useRef, useEffect } from 'react';
import type { PortalGuest } from '@/lib/api/guest-portal';

interface GuestListTableProps {
  guests: PortalGuest[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRemove: (phoneId: string) => Promise<void>;
  isReadOnly: boolean;
  searchQuery: string;
  onSearch: (query: string) => void;
}

export default function GuestListTable({
  guests,
  total,
  page,
  totalPages,
  onPageChange,
  onRemove,
  isReadOnly,
  searchQuery,
  onSearch,
}: GuestListTableProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState('');
  const [searchValue, setSearchValue] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleRemove = useCallback(
    async (phoneId: string) => {
      setRemovingId(phoneId);
      setRemoveError('');
      try {
        await onRemove(phoneId);
      } catch (err) {
        setRemoveError(err instanceof Error ? err.message : 'שגיאה בהסרת המספר');
      } finally {
        setRemovingId(null);
      }
    },
    [onRemove]
  );

  const handleSearchInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearchValue(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearch(val);
      }, 350);
    },
    [onSearch]
  );

  if (total === 0 && !searchQuery) {
    return (
      <div className="portal-section">
        <h2 className="portal-section-title">📋 רשימת אורחים</h2>
        <p className="portal-no-results">
          טרם הועלו מספרים. העלו קובץ או הוסיפו מספרים בודדים.
        </p>
      </div>
    );
  }

  return (
    <div className="portal-section portal-section--list">
      <div className="portal-list-header">
        <h2 className="portal-section-title" style={{ margin: 0 }}>
          📋 רשימת אורחים
        </h2>
        <span className="portal-list-count">{total} אורחים</span>
      </div>

      {/* Search input - controlled */}
      <div className="portal-search-wrapper">
        <input
          type="text"
          className="portal-search-input"
          placeholder="🔍 חיפוש לפי שם או מספר טלפון..."
          aria-label="חיפוש לפי שם או מספר טלפון"
          value={searchValue}
          onChange={handleSearchInput}
          dir="rtl"
        />
      </div>

      {removeError && (
        <p role="alert" className="portal-field-error">{removeError}</p>
      )}

      {/* Scrollable guest table */}
      <div className="portal-guest-scroll">
        {guests.length === 0 ? (
          <p className="portal-no-results">
            לא נמצאו תוצאות לחיפוש &quot;{searchQuery}&quot;
          </p>
        ) : (
          <table className="portal-guest-table" aria-label="רשימת אורחים">
            <thead className="sr-only">
              <tr>
                <th>שם</th>
                <th>טלפון</th>
                <th>סטטוס</th>
                {!isReadOnly && <th>פעולות</th>}
              </tr>
            </thead>
            <tbody>
              {guests.map((guest) => (
                <tr key={guest.id} className="portal-guest-row">
                  <td className="portal-guest-name">
                    {guest.name || '-'}
                  </td>
                  <td className="portal-guest-phone">{guest.phone}</td>
                  <td
                    className={`portal-guest-status ${
                      guest.sent
                        ? 'portal-guest-status--sent'
                        : 'portal-guest-status--pending'
                    }`}
                  >
                    {guest.sent ? 'נשלח ✓' : 'ממתין'}
                  </td>
                  {!isReadOnly && (
                    <td>
                      <button
                        className="portal-guest-remove"
                        onClick={() => handleRemove(guest.id)}
                        disabled={guest.sent || removingId === guest.id}
                        title={guest.sent ? 'לא ניתן להסיר - כבר נשלחה הודעה' : 'הסרה'}
                        aria-label={`הסרת ${guest.name || guest.phone}`}
                      >
                        {removingId === guest.id ? '…' : '🗑'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="portal-pagination">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            ◄ הקודם
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            הבא ►
          </button>
        </div>
      )}
    </div>
  );
}
