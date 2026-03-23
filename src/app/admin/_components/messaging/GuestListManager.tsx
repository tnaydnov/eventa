'use client';

import { useState, useCallback, useRef } from 'react';
import type { GuestPhoneAdmin } from '../shared';

interface GuestListManagerProps {
  eventId: string;
  guests: GuestPhoneAdmin[];
  onLoad: (eventId: string) => Promise<void>;
  onAdd: (eventId: string, phone: string, name?: string) => Promise<{ ok: boolean; error?: string }>;
  onRemove: (eventId: string, phoneId: string) => Promise<{ ok: boolean; error?: string }>;
  onUploadFile: (eventId: string, file: File) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
  isArchived: boolean;
}

export default function GuestListManager({
  eventId,
  guests,
  onLoad,
  onAdd,
  onRemove,
  onUploadFile,
  isArchived,
}: GuestListManagerProps) {
  const [search, setSearch] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = search
    ? guests.filter(
        (g) =>
          g.phone.includes(search) ||
          g.normalizedPhone.includes(search) ||
          (g.name && g.name.includes(search))
      )
    : guests;

  const handleAdd = useCallback(async () => {
    const trimmed = phone.trim();
    if (!trimmed) return;
    setAdding(true);
    const res = await onAdd(eventId, trimmed, name.trim() || undefined);
    if (res.ok) {
      setPhone('');
      setName('');
      await onLoad(eventId);
    } else {
      alert(res.error || 'שגיאה');
    }
    setAdding(false);
  }, [eventId, phone, name, onAdd, onLoad]);

  const handleRemove = useCallback(
    async (phoneId: string) => {
      if (!confirm('להסיר את המספר?')) return;
      setRemovingId(phoneId);
      const res = await onRemove(eventId, phoneId);
      if (!res.ok) alert(res.error || 'שגיאה');
      else await onLoad(eventId);
      setRemovingId(null);
    },
    [eventId, onRemove, onLoad]
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      const res = await onUploadFile(eventId, file);
      if (res.ok) {
        alert('✅ הקובץ הועלה בהצלחה');
        await onLoad(eventId);
      } else {
        alert(res.error || 'שגיאה');
      }
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    },
    [eventId, onUploadFile, onLoad]
  );

  const handleDownloadCSV = useCallback(() => {
    if (guests.length === 0) return;
    const header = 'name,phone,source,pre_event,feedback,created_at\n';
    const rows = guests.map(
      (g) =>
        `"${g.name || ''}","${g.phone}","${g.source}","${g.preEventSent ? 'כן' : 'לא'}","${g.feedbackSent ? 'כן' : 'לא'}","${g.createdAt}"`
    );
    const csv = header + rows.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guests-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [guests, eventId]);

  const sourceLabel = (s: string) => {
    if (s === 'file') return '📁';
    if (s === 'manual') return '✏️';
    if (s === 'portal') return '🌐';
    return s;
  };

  return (
    <div className="ea-section">
      <h3 className="ea-section__title">📋 רשימת אורחים ({guests.length})</h3>

      {/* Action bar */}
      {!isArchived && (
        <div className="msg-actions-row" style={{ marginBottom: 12 }}>
          <button
            className="admin-btn admin-btn--sm admin-btn--ghost"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? '⏳ מעלה…' : '⬆ העלו קובץ'}
          </button>
          <button
            className="admin-btn admin-btn--sm admin-btn--ghost"
            onClick={handleDownloadCSV}
            disabled={guests.length === 0}
          >
            📥 הורידו רשימה
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Add single phone */}
      {!isArchived && (
        <div className="msg-add-row">
          <input
            className="msg-input msg-input--rtl"
            type="text"
            placeholder="שם (אופציונלי)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={adding}
            aria-label="שם אורח"
          />
          <input
            className="msg-input"
            type="tel"
            placeholder="050-1234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={adding}
            dir="ltr"
            aria-label="מספר טלפון"
          />
          <button
            className="admin-btn admin-btn--sm admin-btn--primary"
            onClick={handleAdd}
            disabled={adding || !phone.trim()}
          >
            {adding ? '…' : '+ הוסיפו'}
          </button>
        </div>
      )}

      {/* Search */}
      <input
        className="msg-input msg-search"
        type="text"
        placeholder="🔍 חיפוש לפי טלפון או שם…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        dir="rtl"
        aria-label="חיפוש ברשימת אורחים"
      />

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="msg-empty">
          {guests.length === 0
            ? 'טרם הועלו מספרים.'
            : 'לא נמצאו תוצאות.'}
        </p>
      ) : (
        <div className="msg-table-wrap">
          <table className="msg-table">
            <thead>
              <tr>
                <th scope="col">שם</th>
                <th scope="col">טלפון</th>
                <th scope="col">מקור</th>
                <th scope="col">SMS</th>
                <th scope="col">פידבק</th>
                {!isArchived && <th scope="col">פעולה</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id}>
                  <td>{g.name || '-'}</td>
                  <td dir="ltr" style={{ textAlign: 'left' }}>{g.phone}</td>
                  <td title={g.source}>{sourceLabel(g.source)}</td>
                  <td>{g.preEventSent ? '✅' : '-'}</td>
                  <td>{g.feedbackSent ? '✅' : '-'}</td>
                  {!isArchived && (
                    <td>
                      <button
                        className="admin-btn admin-btn--sm admin-btn--red"
                        onClick={() => handleRemove(g.id)}
                        disabled={g.preEventSent || removingId === g.id}
                        title={g.preEventSent ? 'לא ניתן - כבר נשלחה הודעה' : 'הסרה'}
                      >
                        {removingId === g.id ? '…' : '🗑'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
