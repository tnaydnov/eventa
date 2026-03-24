'use client';

import { useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { getTemplateDownloadUrl } from '@/lib/api';
import type { PortalData } from '@/lib/api/guest-portal';
import { formatDate } from './formatters';
import { useGuestPortal } from './useGuestPortal';
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

// ─── Client component ──────────────────────────────────

export default function GuestUploadClient({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get('k') ?? searchParams.get('token') ?? '';

  const {
    data,
    loading,
    error,
    searchQuery,
    uploadResult,
    handleUpload,
    handleAddPhone,
    handleRemove,
    handlePageChange,
    handleSearch,
  } = useGuestPortal(slug, token);

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
        <div className="portal-error" role="alert">
          <span className="portal-error-icon" aria-hidden="true">⚠️</span>
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
    <main id="main-content" className="portal-container">
      {/* Event header */}
      <div className="portal-header">
        <h1>{data.event.name}</h1>
        <p className="portal-event-date">{formatDate(data.event.startsAt)}</p>
        <span className={`portal-status-badge ${status.cls}`}>
          <span aria-hidden="true">{status.emoji}</span> {status.label}
          {data.uploadStatus === 'uploaded' && ` (${data.total})`}
        </span>
      </div>

      {/* Timing info */}
      {data.event.messagesEnabled && !isReadOnly && (
        <TimingInfo startsAt={data.event.startsAt} />
      )}

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="portal-read-only-banner" role="status">
          {data.uploadStatus === 'started'
            ? <>האירוע התחיל. לא ניתן לעדכן את הרשימה יותר. <span aria-hidden="true">🔒</span></>
            : <>האירוע הסתיים. הרשימה שלכם נשמרה. תודה! <span aria-hidden="true">🎉</span></>}
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

      {/* Upload zone */}
      {!isReadOnly && (
        <UploadZone
          onUpload={handleUpload}
          templateUrl={templateUrl}
        />
      )}

      {/* Add single phone */}
      {!isReadOnly && <AddPhoneForm onAdd={handleAddPhone} />}

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

      {/* Message preview */}
      {data.event.messagesEnabled && !isReadOnly && (
        <MessagePreview
          eventName={data.event.name}
          startsAt={data.event.startsAt}
        />
      )}

      {/* Footer */}
      <div className="portal-info">
        {data.event.messagesEnabled ? (
          <p>הודעות יישלחו אוטומטית 3 שעות לפני תחילת האירוע.</p>
        ) : (
          <p>
            שירות ההודעות לא פעיל לאירוע זה.
            <br />
            הרשימה תשמש לניהול האורחים בלבד.
          </p>
        )}
      </div>
    </main>
  );
}
