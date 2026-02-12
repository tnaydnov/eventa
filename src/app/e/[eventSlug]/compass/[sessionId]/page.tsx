'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistance } from '@/lib/compass-math';
import { PageTransition } from '@/components/Animations';
import MobileGuard from '@/components/MobileGuard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useCompassSession } from './_hooks/useCompassSession';

export default function CompassPage({
  params,
}: {
  params: Promise<{ eventSlug: string; sessionId: string }>;
}) {
  const { eventSlug, sessionId } = use(params);
  const router = useRouter();

  const {
    myLocation,
    otherName,
    permissionError,
    closed,
    arrowAngle,
    distance,
    lowAccuracy,
    handleStop,
  } = useCompassSession(sessionId, eventSlug);

  if (closed) {
    return (
      <MobileGuard>
        <div className="compass-container">
          <div style={{ fontSize: '64px' }}>🧭</div>
          <p>שיתוף המיקום הסתיים</p>
          <button className="btn btn-primary" style={{ maxWidth: '200px' }} onClick={() => router.back()}>
            חזרה
          </button>
        </div>
      </MobileGuard>
    );
  }

  return (
    <MobileGuard>
      <PageTransition>
        <div className="compass-container">
          <h2 style={{ color: 'var(--primary)' }}>🧭 מצפן מפגש</h2>
          {otherName && (
            <p className="compass-label">מנווטים אל {otherName}</p>
          )}

          {permissionError ? (
            <p style={{ color: 'var(--danger)', fontSize: '14px' }}>{permissionError}</p>
          ) : !myLocation ? (
            <div>
              <LoadingSpinner />
              <p className="compass-label">ממתינים למיקום...</p>
            </div>
          ) : (
            <>
              {/* Arrow */}
              <div
                className="compass-arrow"
                style={{ transform: `rotate(${arrowAngle}deg)` }}
              >
                <svg viewBox="0 0 100 100" fill="none">
                  <polygon
                    points="50,10 30,70 50,55 70,70"
                    fill="var(--primary)"
                    stroke="var(--primary-light)"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              <div className="compass-distance">{formatDistance(distance)}</div>

              {lowAccuracy && (
                <p style={{ color: 'var(--warning)', fontSize: '13px', maxWidth: '280px' }}>
                  ⚠️ ייתכן חוסר דיוק בתוך מבנים — נסו להתקרב לאזור פתוח
                </p>
              )}
            </>
          )}

          <button
            className="btn btn-danger"
            style={{ maxWidth: '200px', marginTop: '24px' }}
            onClick={handleStop}
          >
            עצור שיתוף
          </button>
        </div>
      </PageTransition>
    </MobileGuard>
  );
}
