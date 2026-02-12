'use client';

import { useState, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import ImageCropper from '@/components/ImageCropper';
import type { Event } from '@/lib/database.types';
import { useAdminData } from './_components/useAdminData';
import AdminLogin from './_components/AdminLogin';
import Sidebar, { type AdminView } from './_components/Sidebar';
import EventsView from './_components/events/EventsView';
import CreateEventDialog, { type CreateEventData } from './_components/events/CreateEventDialog';
import EventAnalyticsView from './_components/analytics/EventAnalyticsView';
import GlobalAnalyticsView from './_components/analytics/GlobalAnalyticsView';
import QRDialog from './_components/QRDialog';
import ParticipantsDialog from './_components/ParticipantsDialog';

export default function AdminPage() {
  const admin = useAdminData();

  /* ─── View state ─── */
  const [activeView, setActiveView] = useState<AdminView>('events');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNavigate = (view: AdminView) => {
    setActiveView(view);
    setDetailEvent(null);
  };

  /* ─── QR state ─── */
  const [qrEvent, setQrEvent] = useState<Event | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  /* ─── Background upload state ─── */
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [bgUploadId, setBgUploadId] = useState<string | null>(null);
  const [bgCropImage, setBgCropImage] = useState<{ src: string; file: File } | null>(null);

  /* ─── Create event dialog state ─── */
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  /* ─── Event detail view state ─── */
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);

  /* ─── Status counts for sidebar ─── */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of admin.events) {
      counts[e.status] = (counts[e.status] || 0) + 1;
    }
    return counts;
  }, [admin.events]);

  /* ─── QR helpers ─── */
  const generateQR = async (event: Event) => {
    const url = `${window.location.origin}/e/${event.slug}?k=${event.join_code}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 400, margin: 2,
        color: { dark: '#6366f1', light: '#0b0d14' },
        errorCorrectionLevel: 'H',
      });
      setQrDataUrl(dataUrl);
      setQrEvent(event);
    } catch {
      alert('שגיאה ביצירת QR');
    }
  };

  const downloadQR = () => {
    if (!qrDataUrl || !qrEvent) return;
    const link = document.createElement('a');
    link.download = `qr-${qrEvent.slug}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const copyJoinUrl = (event: Event) => {
    const url = `${window.location.origin}/e/${event.slug}?k=${event.join_code}`;
    navigator.clipboard.writeText(url);
    alert('הקישור הועתק! 📋');
  };

  /* ─── Background upload helpers ─── */
  const triggerBgUpload = (eventId: string) => {
    setBgUploadId(eventId);
    bgInputRef.current?.click();
  };

  const handleBgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bgUploadId) return;
    setBgCropImage({ src: URL.createObjectURL(file), file });
    e.target.value = '';
  };

  const handleBgCropDone = async (croppedFile: File) => {
    if (bgCropImage) URL.revokeObjectURL(bgCropImage.src);
    setBgCropImage(null);
    if (!bgUploadId) return;
    const result = await admin.uploadBackground(bgUploadId, croppedFile);
    if (result.ok) {
      alert('✅ רקע הועלה!');
    } else {
      alert(result.error);
    }
    setBgUploadId(null);
  };

  const handleBgCropCancel = () => {
    if (bgCropImage) URL.revokeObjectURL(bgCropImage.src);
    setBgCropImage(null);
    setBgUploadId(null);
  };

  /* ─── View event details (analytics page) ─── */
  const handleViewDetails = (event: Event) => {
    setDetailEvent(event);
  };

  const handleBackFromDetails = () => {
    setDetailEvent(null);
  };

  /* ─── Create event ─── */
  const handleCreateEvent = () => setCreateDialogOpen(true);

  const handleCreateSubmit = async (data: CreateEventData) => {
    return admin.createEvent(data);
  };

  /* ─── Login screen ─── */
  if (!admin.authed) {
    return (
      <div className="admin-root">
        <AdminLogin onLogin={admin.login} />
      </div>
    );
  }

  /* ─── Dashboard ─── */
  return (
    <div className="admin-root">
      <div className="admin-layout">
        {/* Mobile sidebar toggle */}
        <button
          className="admin-sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          ☰
        </button>

        {/* Sidebar */}
        <Sidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          eventCounts={statusCounts}
          totalEvents={admin.events.length}
          onLogout={admin.logout}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <main className="admin-main">
          <div className="admin-main__content">
            {activeView === 'events' && !detailEvent && (
              <EventsView
                events={admin.events}
                loading={admin.loading}
                onRotate={admin.rotateJoinCode}
                onDelete={admin.deleteEvent}
                onGenerateQR={generateQR}
                onCopyUrl={copyJoinUrl}
                onUploadBg={triggerBgUpload}
                onRemoveBg={admin.removeBackground}
                onViewDetails={handleViewDetails}
                onUpdateStatus={admin.updateStatus}
                onCreateEvent={handleCreateEvent}
              />
            )}

            {activeView === 'events' && detailEvent && (
              <EventAnalyticsView
                event={detailEvent}
                onBack={handleBackFromDetails}
                onGenerateQR={generateQR}
                onCopyUrl={copyJoinUrl}
                onUploadBg={triggerBgUpload}
                onRemoveBg={admin.removeBackground}
                onUpdateStatus={(id: string, status: string) => {
                  admin.updateStatus(id, status);
                  // Update detailEvent to reflect new status after reload
                  setTimeout(() => {
                    const updated = admin.events.find(e => e.id === id);
                    if (updated) setDetailEvent(updated);
                  }, 500);
                }}
                onDelete={(id: string) => {
                  admin.deleteEvent(id);
                  setDetailEvent(null);
                }}
                onArchive={(id: string) => {
                  admin.archiveEvent(id);
                  setDetailEvent(null);
                }}
              />
            )}

            {activeView === 'global-analytics' && (
              <GlobalAnalyticsView />
            )}
          </div>
        </main>
      </div>

      {/* Hidden file input for background uploads */}
      <input
        ref={bgInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleBgFile}
      />

      {/* ─── Dialogs ─── */}
      {qrEvent && (
        <QRDialog
          event={qrEvent}
          dataUrl={qrDataUrl}
          onClose={() => setQrEvent(null)}
          onDownload={downloadQR}
          onCopyUrl={copyJoinUrl}
        />
      )}

      {admin.selectedEvent && (
        <ParticipantsDialog
          event={admin.selectedEvent}
          participants={admin.participants}
          onClose={admin.closeParticipants}
          onBan={admin.banParticipant}
        />
      )}

      {bgCropImage && (
        <ImageCropper
          imageSrc={bgCropImage.src}
          aspect={9 / 16}
          onCropDone={handleBgCropDone}
          onCancel={handleBgCropCancel}
          fileName={bgCropImage.file.name}
        />
      )}

      {/* Create Event Dialog */}
      <CreateEventDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreateSubmit}
      />
    </div>
  );
}
