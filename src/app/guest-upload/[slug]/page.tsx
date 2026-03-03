'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  getPortalData,
  uploadGuestFile,
  addGuestPhone,
  removeGuestPhone,
  getTemplateDownloadUrl,
} from '@/lib/api';
import type { PortalData, UploadResult } from '@/lib/api/guest-portal';
import UploadZone from './_components/UploadZone';
import UploadResultDisplay from './_components/UploadResultDisplay';
import AddPhoneForm from './_components/AddPhoneForm';
import GuestListTable from './_components/GuestListTable';
import MessagePreview from './_components/MessagePreview';
import TimingInfo from './_components/TimingInfo';

// ─── Status badge helpers ──────────────────────────────

const STATUS_MAP: Record<
  PortalData['uploadStatus'],
  { emoji: string; label: string; cls: string }
> = {
  empty:    { emoji: '🔴', label: 'לא הועלו מספרים',              cls: 'portal-status-badge--empty' },
  uploaded: { emoji: '🟡', label: 'הועלו - ההודעות טרם נשלחו',      cls: 'portal-status-badge--uploaded' },
  sent:     { emoji: '🟢', label: 'הודעות נשלחו',                   cls: 'portal-status-badge--sent' },
  started:  { emoji: '🔒', label: 'האירוע התחיל - הפורטל נעול',     cls: 'portal-status-badge--archived' },
  archived: { emoji: '⚫', label: 'האירוע הסתיים',                  cls: 'portal-status-badge--archived' },
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('he-IL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ─── Page component ────────────────────────────────────

export default function GuestUploadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get('k') ?? searchParams.get('token') ?? '';

  // State
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // ── Load portal data ──
  const loadData = useCallback(
    async (p = page, search = searchQuery) => {
      if (!token) {
        setError('קישור לא תקין - חסר טוקן אימות');
        setLoading(false);
        return;
      }
      try {
        const result = await getPortalData(token, p, search);
        // Verify event slug matches URL
        if (result.event.slug !== slug) {
          setError('הקישור אינו תואם את האירוע');
          setLoading(false);
          return;
        }
        setData(result);
        setPage(p);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    },
    [token, slug, page, searchQuery]
  );

  useEffect(() => {
    loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, slug]);

  // ── Upload handler ──
  const handleUpload = useCallback(
    async (file: File) => {
      try {
        const result = await uploadGuestFile(token, file);
        setUploadResult(result);
        // Refresh guest list
        await loadData(1);
      } catch (err) {
        setUploadResult({
          success: false,
          added: 0,
          duplicates: 0,
          invalid: 0,
          errors: [
            {
              row: 0,
              phone: '',
              reason: err instanceof Error ? err.message : 'שגיאה בהעלאת הקובץ',
            },
          ],
          totalInList: data?.total ?? 0,
        });
      }
    },
    [token, loadData, data?.total]
  );

  // ── Add phone handler ──
  const handleAddPhone = useCallback(
    async (phone: string, name?: string) => {
      const result = await addGuestPhone(token, phone, name);
      if (result.success) {
        await loadData(1);
      }
      return result;
    },
    [token, loadData]
  );

  // ── Remove phone handler ──
  const handleRemove = useCallback(
    async (phoneId: string) => {
      const result = await removeGuestPhone(token, phoneId);
      if (result.success) {
        await loadData(page);
      }
    },
    [token, loadData, page]
  );

  // ── Page change ──
  const handlePageChange = useCallback(
    (newPage: number) => {
      loadData(newPage, searchQuery);
    },
    [loadData, searchQuery]
  );

  // ── Search handler ──
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      loadData(1, query);
    },
    [loadData]
  );

  // ─── Render states ───────────────────────────────────

  if (loading) {
    return (
      <div className="portal-container">
        <div className="portal-loading">
          <LoadingSpinner />
          <span>טוען את פורטל האורחים…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="portal-container">
        <div className="portal-error">
          <span className="portal-error-icon">⚠️</span>
          <span className="portal-error-title">שגיאה</span>
          <p>{error || 'לא ניתן לטעון את הנתונים'}</p>
        </div>
      </div>
    );
  }

  const status = STATUS_MAP[data.uploadStatus];
  const isReadOnly = data.isReadOnly;
  const templateUrl = getTemplateDownloadUrl(token);

  return (
    <div className="portal-container">
      {/* Event header */}
      <div className="portal-header">
        <h1>{data.event.name}</h1>
        <p className="portal-event-date">{formatDate(data.event.startsAt)}</p>
        <span className={`portal-status-badge ${status.cls}`}>
          {status.emoji} {status.label}
          {data.uploadStatus === 'uploaded' && ` (${data.total})`}
        </span>
      </div>

      {/* Timing info - right after header, only when WA enabled and not read-only */}
      {data.event.waMessagesEnabled && !isReadOnly && (
        <TimingInfo startsAt={data.event.startsAt} />
      )}

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="portal-read-only-banner">
          {data.uploadStatus === 'started'
            ? 'האירוע התחיל. לא ניתן לעדכן את הרשימה יותר. 🔒'
            : 'האירוע הסתיים. הרשימה שלכם נשמרה. תודה! 🎉'}
        </div>
      )}

      {/* Upload result */}
      {uploadResult && (
        <UploadResultDisplay
          added={uploadResult.added}
          duplicates={uploadResult.duplicates}
          invalid={uploadResult.invalid}
          errors={uploadResult.errors}
          totalInList={uploadResult.totalInList}
        />
      )}

      {/* Upload zone - hidden when read-only */}
      {!isReadOnly && (
        <UploadZone
          onUpload={handleUpload}
          templateUrl={templateUrl}
          disabled={isReadOnly}
        />
      )}

      {/* Add single phone */}
      {!isReadOnly && (
        <AddPhoneForm onAdd={handleAddPhone} disabled={isReadOnly} />
      )}

      {/* Guest list */}
      <GuestListTable
        guests={data.guests}
        total={data.total}
        page={data.page}
        totalPages={data.totalPages}
        onPageChange={handlePageChange}
        onRemove={handleRemove}
        isReadOnly={isReadOnly}
        searchQuery={searchQuery}
        onSearch={handleSearch}
      />

      {/* Message preview & timing info - only when WA enabled */}
      {data.event.waMessagesEnabled && !isReadOnly && (
        <MessagePreview
          eventName={data.event.name}
          startsAt={data.event.startsAt}
        />
      )}

      {/* Footer */}
      <div className="portal-info">
        {data.event.waMessagesEnabled ? (
          <p>
            הודעות WhatsApp יישלחו אוטומטית 3 שעות לפני תחילת האירוע.
          </p>
        ) : (
          <p>
            שירות הודעות WhatsApp לא פעיל לאירוע זה.
            <br />
            הרשימה תשמש לניהול האורחים בלבד.
          </p>
        )}
      </div>
    </div>
  );
}
