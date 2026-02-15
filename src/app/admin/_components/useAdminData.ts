'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Event } from '@/lib/database.types';
import { adminFetch, type EventStats, type AdminParticipant } from './shared';

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
    }).catch(() => {});
  }, [authedFetch]);

  /* ─── login ─── */
  const login = async (password: string): Promise<{ ok: boolean; error?: string }> => {
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

  /* ─── rotate join code ─── */
  const rotateJoinCode = async (id: string) => {
    const res = await authedFetch(`/api/admin/events/${id}/rotate`, { method: 'POST' });
    if (res.ok) {
      loadEvents();
      alert('✅ קוד חדש נוצר');
    } else {
      alert('שגיאה בהחלפת קוד');
    }
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

  return {
    authed, events, loading, stats,
    selectedEvent, participants,
    login, logout, loadEvents,
    createEvent, toggleEvent, rotateJoinCode, deleteEvent,
    loadStats, loadParticipants, banParticipant, closeParticipants,
    uploadBackground, removeBackground, updateStatus, archiveEvent,
  };
}
