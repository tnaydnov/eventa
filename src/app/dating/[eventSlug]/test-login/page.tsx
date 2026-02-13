'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/lib/store';
import type { Participant } from '@/lib/database.types';

/**
 * DEV-ONLY page: lets you switch between test users for chat testing.
 * Blocked in production builds.
 */
export default function TestLoginPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = use(params);
  const router = useRouter();

  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-white">
        <p>Page not found</p>
      </div>
    );
  }

  return <TestLoginContent eventSlug={eventSlug} />;
}

function TestLoginContent({ eventSlug }: { eventSlug: string }) {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const setSession = useSessionStore((s) => s.setSession);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [eventData, setEventData] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Fetch event
      const { data: ev } = await supabase
        .from('events')
        .select('id, name')
        .eq('slug', eventSlug)
        .single();

      if (!ev) {
        setLoading(false);
        return;
      }
      setEventData(ev);

      // Fetch all participants
      const { data: parts } = await supabase
        .from('participants')
        .select('id, event_id, device_fingerprint, display_name, gender, attracted_to, bio, age, city, looking_for, is_banned, last_seen_at, created_at')
        .eq('event_id', ev.id)
        .order('display_name');

      setParticipants((parts as Participant[]) || []);
      setLoading(false);
    })();
  }, [eventSlug]);

  const loginAs = async (p: Participant) => {
    const s = {
      eventId: eventData!.id,
      eventSlug,
      eventName: eventData!.name,
      participantId: p.id,
    };

    // Set the httpOnly JWT cookie so /api/secure/* routes work
    await fetch('/api/auth/test-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    });

    setSession(s);
    router.push(`/dating/${eventSlug}`);
  };

  const genderEmoji = (g: string) =>
    g === 'female' ? '👩' : g === 'male' ? '👨' : '🧑';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-white">
        <p>טוען...</p>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-white">
        <p>אירוע לא נמצא</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-white p-6" dir="rtl">
      <h1 className="text-2xl font-bold text-[var(--primary)] mb-2">
        🧪 כניסת טסט
      </h1>
      <p className="text-gray-400 text-sm mb-1">{eventData.name}</p>
      {session && (
        <p className="text-xs text-green-400 mb-4">
          מחובר כרגע כ: <strong>{participants.find((p) => p.id === session.participantId)?.display_name || '?'}</strong>
        </p>
      )}
      <p className="text-gray-500 text-xs mb-6">
        פתח כל משתמש בטאב נפרד (Private / Incognito) כדי לבדוק צ&apos;אטים
      </p>

      <div className="space-y-3">
        {participants.map((p) => (
          <button
            key={p.id}
            onClick={() => loginAs(p)}
            className={`w-full text-right p-4 rounded-xl border transition-all ${
              session?.participantId === p.id
                ? 'border-[var(--primary)] bg-[var(--primary)]/20'
                : 'border-gray-700 bg-[var(--surface)] hover:border-gray-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{p.attracted_to === 'men' ? '→👨' : p.attracted_to === 'women' ? '→👩' : '→🌈'}</span>
                {p.age && <span>{p.age}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{p.display_name}</span>
                <span className="text-2xl">{genderEmoji(p.gender)}</span>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-1">{p.bio}</p>
            <p className="text-[10px] text-gray-600 mt-1 font-mono ltr">{p.device_fingerprint}</p>
          </button>
        ))}
      </div>

      <div className="mt-8 p-4 bg-[var(--surface)] rounded-xl border border-gray-700">
        <h2 className="font-bold mb-2 text-sm">📋 איך לבדוק צ&apos;אטים</h2>
        <ol className="list-decimal list-inside text-sm text-gray-400 space-y-1">
          <li>פתח 2 חלונות אינקוגניטו נפרדים</li>
          <li>בכל חלון, גש לכתובת הזו</li>
          <li>בחר משתמש שונה בכל חלון</li>
          <li>עכשיו תוכל לשלוח לייקים וצ&apos;אטים ביניהם</li>
        </ol>
      </div>

      <p className="text-center text-xs text-gray-600 mt-6">
        כתובת דף זה:&nbsp;
        <span className="font-mono ltr text-gray-500">
          /dating/{eventSlug}/test-login
        </span>
      </p>
    </div>
  );
}
