'use client';

import { useEffect } from 'react';
import type { Event } from '@/lib/database.types';
import type {
  EventMessagingStatus,
  GuestPhoneAdmin,
  MessageLogEntry,
  MessagingConfig,
} from '../shared';
import MessagingControls from './MessagingControls';
import GuestListManager from './GuestListManager';
import MessageLog from './MessageLog';

interface MessagingTabProps {
  event: Event;
  messagingStatus: EventMessagingStatus | null;
  guestPhones: GuestPhoneAdmin[];
  messageLog: MessageLogEntry[];
  loadMessagingStatus: (eventId: string) => Promise<void>;
  updateMessagingConfig: (eventId: string, config: Partial<MessagingConfig>) => Promise<{ ok: boolean; error?: string }>;
  triggerMessages: (eventId: string, type: 'pre_event' | 'feedback') => Promise<{ ok: boolean; sent?: number; error?: string }>;
  loadGuestPhones: (eventId: string) => Promise<void>;
  adminAddGuestPhone: (eventId: string, phone: string, name?: string) => Promise<{ ok: boolean; error?: string }>;
  adminRemoveGuestPhone: (eventId: string, phoneId: string) => Promise<{ ok: boolean; error?: string }>;
  adminUploadGuestFile: (eventId: string, file: File) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
  regeneratePortalToken: (eventId: string) => Promise<{ ok: boolean; token?: string; error?: string }>;
  sendClientEmail: (eventId: string, type: string, opts?: { subject?: string; body?: string }) => Promise<{ ok: boolean; error?: string }>;
  sendQrPage: (eventId: string, files: File[]) => Promise<{ ok: boolean; error?: string }>;
  loadMessageLog: (eventId: string) => Promise<void>;
}

export default function MessagingTab({
  event,
  messagingStatus,
  guestPhones,
  messageLog,
  loadMessagingStatus,
  updateMessagingConfig,
  triggerMessages,
  loadGuestPhones,
  adminAddGuestPhone,
  adminRemoveGuestPhone,
  adminUploadGuestFile,
  regeneratePortalToken,
  sendClientEmail,
  sendQrPage,
  loadMessageLog,
}: MessagingTabProps) {
  const isArchived = event.status === 'archived';

  // Load data on mount
  useEffect(() => {
    loadMessagingStatus(event.id);
    loadGuestPhones(event.id);
    loadMessageLog(event.id);
  }, [event.id, loadMessagingStatus, loadGuestPhones, loadMessageLog]);

  if (!messagingStatus) {
    return (
      <div className="ea-loading">
        <div className="admin-skeleton admin-skeleton--card" />
        <div className="admin-skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <div className="msg-tab">
      {/* Controls: status, portal, manual actions */}
      <MessagingControls
        eventId={event.id}
        eventSlug={event.slug}
        eventName={event.name}
        eventDate={event.starts_at}
        status={messagingStatus}
        onToggleWA={updateMessagingConfig}
        onTrigger={triggerMessages}
        onSendEmail={sendClientEmail}
        onSendQrPage={sendQrPage}
        onRegenerateToken={regeneratePortalToken}
        onUpdateConfig={updateMessagingConfig}
        isArchived={isArchived}
      />

      {/* Guest list management */}
      <GuestListManager
        eventId={event.id}
        guests={guestPhones}
        onLoad={loadGuestPhones}
        onAdd={adminAddGuestPhone}
        onRemove={adminRemoveGuestPhone}
        onUploadFile={adminUploadGuestFile}
        isArchived={isArchived}
      />

      {/* Message log */}
      <MessageLog entries={messageLog} />
    </div>
  );
}
