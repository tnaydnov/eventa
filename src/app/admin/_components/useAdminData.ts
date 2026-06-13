'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Event } from '@/lib/database.types';
import {
  adminFetch,
  type EventStats,
  type AdminParticipant,
  type EventRequest,
  type EventMessagingStatus,
  type GuestPhoneAdmin,
  type MessageLogEntry,
  type MessagingConfig,
} from './shared';

/**
 * Custom hook encapsulating all admin data fetching, mutations, and state.
 * Keeps page.tsx as a thin rendering shell.
 */
export function useAdminData() {
  const [authed, setAuthed] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Record<string, EventStats>>({});
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<AdminParticipant[]>([]);
  const [requests, setRequests] = useState<EventRequest[]>([]);
  const [messagingStatus, setMessagingStatus] = useState<EventMessagingStatus | null>(null);
  const [guestPhones, setGuestPhones] = useState<GuestPhoneAdmin[]>([]);
  const [messageLog, setMessageLog] = useState<MessageLogEntry[]>([]);

  /** Wrapper around adminFetch that resets auth state on 401 */
  const authedFetch: typeof adminFetch = useCallback(async (url, init) => {
    const res = await adminFetch(url, init);
    if (res.status === 401) {
      setAuthed(false);
      setEvents([]);
    }
    return res;
  }, []);

  /* ─── load events ─── */
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch('/api/admin/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  // On mount: check if already authenticated via httpOnly cookie
  useEffect(() => {
    authedFetch('/api/admin/events').then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setAuthed(true);
      }
    }).catch((err) => console.warn('[useAdminData] auth check failed:', err));
  }, [authedFetch]);

  /* ─── login ─── */
  const login = async (
    password: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await adminFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setAuthed(true);
        loadEvents();
        return { ok: true };
      }
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || 'סיסמה שגויה' };
    } catch {
      return { ok: false, error: 'שגיאת תקשורת' };
    }
  };

  /* ─── logout ─── */
  const logout = async () => {
    await adminFetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
    setEvents([]);
    setStats({});
    setSelectedEvent(null);
    setParticipants([]);
  };

  /* ─── create event ─── */
  const createEvent = async (data: {
    name: string;
    slug?: string;
    event_type?: string;
    description?: string;
    starts_at?: string;
    ends_at?: string;
    wa_messages_enabled?: boolean;
    client_name?: string;
    client_email?: string;
    client_phone?: string;
    communication_preference?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    const res = await authedFetch('/api/admin/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.ok) {
      loadEvents();
      return { ok: true };
    }
    const err = await res.json().catch(() => ({}));
    // Surface per-field Zod validation errors so the admin can see exactly what failed
    if (err.details && typeof err.details === 'object') {
      const fieldLabels: Record<string, string> = {
        name: 'שם אירוע',
        slug: 'כתובת',
        event_type: 'סוג אירוע',
        starts_at: 'תחילת אירוע',
        ends_at: 'סיום אירוע',
        client_name: 'שם לקוח',
        client_email: 'אימייל',
        client_phone: 'טלפון',
        communication_preference: 'העדפת תקשורת',
      };
      const messages = Object.entries(err.details as Record<string, string[]>)
        .filter(([, msgs]) => msgs?.length)
        .map(([field, msgs]) => `${fieldLabels[field] ?? field}: ${msgs[0]}`)
        .join(' | ');
      if (messages) return { ok: false, error: messages };
    }
    return { ok: false, error: err.error || 'שגיאה ביצירת אירוע' };
  };

  /* ─── toggle active ─── */
  const toggleEvent = async (id: string, isActive: boolean) => {
    const res = await authedFetch(`/api/admin/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !isActive }),
    });
    if (!res.ok) { alert('שגיאה בעדכון סטטוס האירוע'); return; }
    loadEvents();
  };

  /* ─── delete event ─── */
  const deleteEvent = async (id: string) => {
    if (!confirm('למחוק את האירוע? לא ניתן לשחזר.')) return;
    const res = await authedFetch(`/api/admin/events/${id}/delete`, { method: 'DELETE' });
    if (res.ok) {
      loadEvents();
    } else {
      alert('שגיאה במחיקת האירוע');
    }
  };

  /* ─── stats ─── */
  const loadStats = async (eventId: string) => {
    const res = await authedFetch(`/api/admin/events/${eventId}/stats`);
    if (res.ok) {
      const data = await res.json();
      setStats(prev => ({ ...prev, [eventId]: data }));
    } else {
      alert('שגיאה בטעינת סטטיסטיקה');
    }
  };

  /* ─── participants ─── */
  const loadParticipants = async (event: Event) => {
    setSelectedEvent(event);
    const res = await authedFetch(`/api/admin/events/${event.id}/participants`);
    if (res.ok) {
      const data = await res.json();
      setParticipants(data.participants || []);
    } else {
      alert('שגיאה בטעינת משתתפים');
    }
  };

  const banParticipant = async (pid: string, isBanned: boolean) => {
    if (!selectedEvent) return;
    const res = await authedFetch(`/api/admin/events/${selectedEvent.id}/participants`, {
      method: 'PATCH',
      body: JSON.stringify({ participantId: pid, is_banned: !isBanned }),
    });
    if (!res.ok) { alert('שגיאה בעדכון חסימה'); return; }
    loadParticipants(selectedEvent);
  };

  const closeParticipants = () => setSelectedEvent(null);

  /* ─── background image ─── */
  const uploadBackground = async (eventId: string, file: File): Promise<{ ok: boolean; error?: string }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await authedFetch(`/api/admin/events/${eventId}/background`, {
      method: 'POST',
      body: form,
    });
    if (res.ok) {
      loadEvents();
      return { ok: true };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error || 'שגיאה בהעלאת רקע' };
  };

  const removeBackground = async (eventId: string) => {
    if (!confirm('להסיר את תמונת הרקע?')) return;
    const res = await authedFetch(`/api/admin/events/${eventId}/background`, { method: 'DELETE' });
    if (res.ok) {
      loadEvents();
      alert('✅ רקע הוסר');
    } else {
      alert('שגיאה בהסרת רקע');
    }
  };

  /* ─── update event status ─── */
  const updateStatus = async (id: string, status: string) => {
    const isActive = status === 'active';
    const res = await authedFetch(`/api/admin/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, is_active: isActive }),
    });
    if (!res.ok) { alert('שגיאה בעדכון סטטוס'); return; }
    loadEvents();
  };

  /* ─── archive event ─── */
  const archiveEvent = async (id: string) => {
    if (!confirm('לארכב את האירוע? כל נתוני המשתתפים יימחקו לצמיתות.')) return;
    const res = await authedFetch(`/api/admin/events/${id}/archive`, { method: 'POST' });
    if (res.ok) {
      loadEvents();
      alert('✅ האירוע הועבר לארכיון');
    } else {
      alert('שגיאה בארכוב האירוע');
    }
  };

  /* ─── requests ─── */
  const loadRequests = useCallback(async () => {
    try {
      const res = await authedFetch('/api/admin/requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.warn('[useAdminData] loadRequests failed:', err);
    }
  }, [authedFetch]);

  const approveRequest = async (requestId: string, adminNotes?: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await authedFetch('/api/admin/requests', {
      method: 'POST',
      body: JSON.stringify({ requestId, action: 'approve', adminNotes }),
    });
    if (res.ok) {
      loadRequests();
      loadEvents();
      return { ok: true };
    }
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || 'שגיאה באישור הבקשה' };
  };

  const denyRequest = async (requestId: string, adminNotes?: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await authedFetch('/api/admin/requests', {
      method: 'POST',
      body: JSON.stringify({ requestId, action: 'deny', adminNotes }),
    });
    if (res.ok) {
      loadRequests();
      return { ok: true };
    }
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || 'שגיאה בדחיית הבקשה' };
  };

  const deleteRequest = async (requestId: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await authedFetch('/api/admin/requests', {
      method: 'DELETE',
      body: JSON.stringify({ requestId }),
    });
    if (res.ok) {
      loadRequests();
      loadEvents();
      return { ok: true };
    }
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || 'שגיאה במחיקת הבקשה' };
  };

  // Load requests on mount alongside events
  useEffect(() => {
    if (authed) loadRequests();
  }, [authed, loadRequests]);

  /* ─── messaging status ─── */
  const loadMessagingStatus = useCallback(async (eventId: string) => {
    try {
      const res = await authedFetch(`/api/admin/events/${eventId}/messaging`);
      if (res.ok) {
        const raw = await res.json();
        // Map snake_case API response → camelCase EventMessagingStatus
        setMessagingStatus({
          messagesEnabled: raw.wa_messages_enabled ?? false,
          preEventSendAt: raw.pre_event_send_at ?? null,
          feedbackSendAt: raw.feedback_send_at ?? null,
          preEventSentCount: raw.pre_event_sent_count ?? 0,
          feedbackSentCount: raw.feedback_sent_count ?? 0,
          totalGuestPhones: raw.guest_list_count ?? 0,
          portalTokenActive: !!raw.portal_token,
          portalToken: raw.portal_token ?? null,
        });
      }
    } catch (err) {
      console.warn('[useAdminData] loadMessagingStatus failed:', err);
    }
  }, [authedFetch]);

  const updateMessagingConfig = async (eventId: string, config: Partial<MessagingConfig>): Promise<{ ok: boolean; error?: string }> => {
    // Convert camelCase client config → snake_case API format
    const apiPayload: Record<string, unknown> = {};
    if (config.messagesEnabled !== undefined) {
      apiPayload.wa_messages_enabled = config.messagesEnabled;
    }
    if (config.preEventHoursBefore !== undefined || config.feedbackHoursAfter !== undefined) {
      apiPayload.messaging_config = {
        ...(config.preEventHoursBefore !== undefined && { pre_event_hours_before: config.preEventHoursBefore }),
        ...(config.feedbackHoursAfter !== undefined && { feedback_hours_after: config.feedbackHoursAfter }),
      };
    }

    const res = await authedFetch(`/api/admin/events/${eventId}/messaging`, {
      method: 'PATCH',
      body: JSON.stringify(apiPayload),
    });
    if (res.ok) {
      // Update local events state immediately if messaging toggle changed
      if (config.messagesEnabled !== undefined) {
        setEvents(prev => prev.map(e =>
          e.id === eventId ? { ...e, wa_messages_enabled: config.messagesEnabled! } : e
        ));
      }
      await loadMessagingStatus(eventId);
      return { ok: true };
    }
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || 'שגיאה בעדכון הגדרות הודעות' };
  };

  const triggerMessages = async (eventId: string, type: 'pre_event' | 'feedback'): Promise<{ ok: boolean; sent?: number; error?: string }> => {
    const res = await authedFetch(`/api/admin/events/${eventId}/messaging`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await loadMessagingStatus(eventId);
      return { ok: true, sent: data.sent };
    }
    return { ok: false, error: data.error || 'שגיאה בשליחת הודעות' };
  };

  /* ─── guest phones ─── */
  const loadGuestPhones = useCallback(async (eventId: string) => {
    try {
      const res = await authedFetch(`/api/admin/events/${eventId}/guests`);
      if (res.ok) {
        const raw = await res.json();
        // Map snake_case API response → camelCase GuestPhoneAdmin
        const mapped = (raw.guests || []).map((g: Record<string, unknown>) => ({
          id: g.id as string,
          phone: g.phone as string,
          name: (g.guest_name as string) || null,
          source: (g.source as string) || 'manual',
          normalizedPhone: (g.phone as string) || '',
          preEventSent: g.wa_pre_event_sent === true,
          feedbackSent: g.wa_feedback_sent === true,
          createdAt: (g.created_at as string) || '',
        }));
        setGuestPhones(mapped);
      }
    } catch (err) {
      console.warn('[useAdminData] loadGuestPhones failed:', err);
    }
  }, [authedFetch]);

  const adminAddGuestPhone = async (
    eventId: string,
    phone: string,
    name?: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await authedFetch(`/api/admin/events/${eventId}/guests`, {
      method: 'POST',
      body: JSON.stringify({ phone, name }),
    });
    if (res.ok) {
      await loadGuestPhones(eventId);
      return { ok: true };
    }
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || 'שגיאה בהוספת מספר' };
  };

  const adminRemoveGuestPhone = async (eventId: string, phoneId: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await authedFetch(`/api/admin/events/${eventId}/guests`, {
      method: 'DELETE',
      body: JSON.stringify({ phoneId }),
    });
    if (res.ok) {
      await loadGuestPhones(eventId);
      return { ok: true };
    }
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || 'שגיאה בהסרת מספר' };
  };

  const adminUploadGuestFile = async (eventId: string, file: File): Promise<{ ok: boolean; result?: unknown; error?: string }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await authedFetch(`/api/admin/events/${eventId}/guests`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await loadGuestPhones(eventId);
      return { ok: true, result: data };
    }
    return { ok: false, error: data.error || 'שגיאה בהעלאת קובץ' };
  };

  /* ─── portal token ─── */
  const regeneratePortalToken = async (eventId: string): Promise<{ ok: boolean; token?: string; error?: string }> => {
    const res = await authedFetch(`/api/admin/events/${eventId}/portal-token`, {
      method: 'POST',
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await loadMessagingStatus(eventId);
      return { ok: true, token: data.token };
    }
    return { ok: false, error: data.error || 'שגיאה ביצירת טוקן' };
  };

  /* ─── send email ─── */
  const sendClientEmail = async (
    eventId: string,
    emailType: string,
    options?: { subject?: string; body?: string }
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await authedFetch(`/api/admin/events/${eventId}/send-email`, {
      method: 'POST',
      body: JSON.stringify({ type: emailType, ...options }),
    });
    if (res.ok) return { ok: true };
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || 'שגיאה בשליחת אימייל' };
  };

  /* ─── send QR page email with attachments ─── */
  const sendQrPage = async (
    eventId: string,
    files: File[],
    qrOnly?: boolean
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      // Step 1: Upload each file to Supabase Storage via signed URLs
      // (bypasses Vercel's 4.5 MB body limit for serverless functions)
      const storagePaths: string[] = [];
      for (const file of files) {
        // Get a signed upload URL
        const urlRes = await authedFetch(
          `/api/admin/events/${eventId}/qr-upload-url`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
            }),
          }
        );
        if (!urlRes.ok) {
          const err = await urlRes.json().catch(() => ({}));
          return { ok: false, error: err.error || `שגיאה בהעלאת ${file.name}` };
        }
        const { signedUrl, storagePath } = await urlRes.json();

        // Upload directly to Supabase (goes to storage, not through Vercel)
        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!uploadRes.ok) {
          return { ok: false, error: `שגיאה בהעלאת ${file.name}` };
        }
        storagePaths.push(storagePath);
      }

      // Step 2: Tell the API to send the email with the uploaded files
      const res = await authedFetch(
        `/api/admin/events/${eventId}/send-qr-page`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storagePaths, qrOnly: !!qrOnly }),
        }
      );
      if (res.ok) {
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, qr_page_sent: true } : e));
        return { ok: true };
      }
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error || 'שגיאה בשליחת דף QR' };
    } catch (e) {
      console.error('[sendQrPage] error:', e);
      return { ok: false, error: 'שגיאה בשליחת דף QR' };
    }
  };

  /* ─── message log (placeholder for future API) ─── */
  const loadMessageLog = useCallback(async (eventId: string) => {
    try {
      const res = await authedFetch(`/api/admin/events/${eventId}/messaging`);
      if (res.ok) {
        const data = await res.json();
        // The messaging endpoint returns messageLog if available
        if (data.messageLog) {
          setMessageLog(data.messageLog);
          return;
        }
      }
    } catch (err) {
      console.warn('[useAdminData] loadMessageLog failed:', err);
    }
    setMessageLog([]);
  }, [authedFetch]);

  /* ─── payment management ─── */
  const markAsPaid = async (
    requestId: string,
    paymentMethod: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await authedFetch('/api/admin/requests', {
      method: 'PATCH',
      body: JSON.stringify({ requestId, action: 'mark_paid', paymentMethod }),
    });
    if (res.ok) {
      loadRequests();
      return { ok: true };
    }
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || 'שגיאה בעדכון תשלום' };
  };

  const waivePayment = async (requestId: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await authedFetch('/api/admin/requests', {
      method: 'PATCH',
      body: JSON.stringify({ requestId, action: 'waive' }),
    });
    if (res.ok) {
      loadRequests();
      return { ok: true };
    }
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || 'שגיאה בביטול תשלום' };
  };

  const resendPaymentLink = async (requestId: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await authedFetch('/api/admin/requests', {
      method: 'PATCH',
      body: JSON.stringify({ requestId, action: 'resend_link' }),
    });
    if (res.ok) {
      loadRequests();
      return { ok: true };
    }
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || 'שגיאה בשליחת קישור תשלום' };
  };

  /* ─── toggle QR page sent indicator ─── */
  const toggleQrSent = async (eventId: string, sent: boolean) => {
    const res = await authedFetch(`/api/admin/events/${eventId}/qr-sent`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sent }),
    });
    if (res.ok) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, qr_page_sent: sent } : e));
    }
  };

  /* ─── toggle event payment status ─── */
  const togglePaymentStatus = async (eventId: string, status: 'unpaid' | 'paid' | 'waived') => {
    const res = await authedFetch(`/api/admin/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ payment_status: status }),
    });
    if (res.ok) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, payment_status: status } : e));
    } else {
      alert('שגיאה בעדכון סטטוס תשלום');
    }
  };

  /* ─── update event details (client info, dates, etc.) ─── */
  const updateEventDetails = async (
    id: string,
    updates: { client_name?: string | null; client_email?: string | null; client_phone?: string | null; communication_preference?: string | null; starts_at?: string; ends_at?: string }
  ): Promise<{ ok: boolean; error?: string; preEventSentCount?: number }> => {
    try {
      const res = await authedFetch(`/api/admin/events/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return { ok: false, error: d.error || 'שגיאה בעדכון' };
      }
      const d = await res.json().catch(() => ({}));
      // Update local state
      setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } as typeof e : e));
      return { ok: true, preEventSentCount: d.preEventSentCount ?? 0 };
    } catch {
      return { ok: false, error: 'שגיאת תקשורת' };
    }
  };

  return {
    authed, events, loading, stats, requests,
    selectedEvent, participants,
    messagingStatus, guestPhones, messageLog,
    login, logout, loadEvents,
    createEvent, toggleEvent, deleteEvent,
    loadStats, loadParticipants, banParticipant, closeParticipants,
    uploadBackground, removeBackground, updateStatus, archiveEvent,
    loadRequests, approveRequest, denyRequest, deleteRequest,
    loadMessagingStatus, updateMessagingConfig, triggerMessages,
    loadGuestPhones, adminAddGuestPhone, adminRemoveGuestPhone, adminUploadGuestFile,
    regeneratePortalToken, sendClientEmail, sendQrPage, loadMessageLog,
    markAsPaid, waivePayment, resendPaymentLink, toggleQrSent, togglePaymentStatus,
    updateEventDetails,
  };
}
