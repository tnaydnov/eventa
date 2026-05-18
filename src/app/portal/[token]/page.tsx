'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type EventData = {
  id: string;
  name: string;
  slug: string;
  type: string;
  starts_at: string;
  ends_at: string;
  venue_name?: string;
};

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [hasReport, setHasReport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/portal/${token}/report`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'הקישור אינו תקף' : 'שגיאת שרת');
        return r.json();
      })
      .then((data: { event: EventData; has_report: boolean }) => {
        setEvent(data.event);
        setHasReport(data.has_report);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4A59A] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-center px-6" dir="rtl">
        <div>
          <p className="text-white text-xl mb-2">הקישור אינו תקף או פג תוקפו</p>
          <p className="text-white/50 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const startsAt = new Date(event.starts_at);
  const endsAt = event.ends_at ? new Date(event.ends_at) : null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" dir="rtl">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">{event.name}</h1>
          <p className="text-sm text-white/50">
            {startsAt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            {event.venue_name ? ` · ${event.venue_name}` : ''}
          </p>
        </div>
        <div className="w-8 h-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/Eventa_Logo.png" alt="Eventa" className="h-8 object-contain" />
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex border-b border-white/10 px-6">
        <Link
          href={`/portal/${token}`}
          className="px-4 py-3 text-sm font-medium text-[#D4A59A] border-b-2 border-[#D4A59A]"
        >
          סקירה כללית
        </Link>
        {hasReport && (
          <Link
            href={`/portal/${token}/report`}
            className="px-4 py-3 text-sm font-medium text-white/50 hover:text-white transition-colors"
          >
            דוח מפורט
          </Link>
        )}
      </nav>

      {/* Content */}
      <div className="px-6 py-8 max-w-2xl mx-auto">
        {/* Event stats summary */}
        <div className="bg-white/5 rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold mb-4 text-white/80">פרטי האירוע</h2>
          <dl className="space-y-3">
            <div className="flex justify-between items-center">
              <dt className="text-sm text-white/50">סוג</dt>
              <dd className="text-sm font-medium">{event.type}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm text-white/50">תחילה</dt>
              <dd className="text-sm font-medium">
                {startsAt.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </dd>
            </div>
            {endsAt && (
              <div className="flex justify-between items-center">
                <dt className="text-sm text-white/50">סיום</dt>
                <dd className="text-sm font-medium">
                  {endsAt.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {hasReport ? (
          <div className="text-center">
            <p className="text-white/60 mb-4 text-sm">הדוח המלא של האירוע מוכן</p>
            <Link
              href={`/portal/${token}/report`}
              className="inline-block bg-[#D4A59A] text-[#0A0A0A] font-semibold px-8 py-3 rounded-full text-sm hover:bg-[#c49080] transition-colors"
            >
              צפייה בדוח המלא
            </Link>
          </div>
        ) : (
          <div className="text-center bg-white/5 rounded-2xl p-8">
            <p className="text-white/40 text-sm">הדוח יהיה זמין לאחר סיום האירוע</p>
          </div>
        )}
      </div>
    </div>
  );
}
