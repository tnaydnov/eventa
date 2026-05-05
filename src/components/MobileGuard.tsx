'use client';

import { useEffect, useState, type ReactNode } from 'react';
import PremiumSplashScreen from '@/components/join/PremiumSplashScreen';

export default function MobileGuard({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const ua = navigator.userAgent.toLowerCase();
      const mobileUA =
        /android|iphone|ipad|ipod|mobile|webos|blackberry|opera mini/.test(ua);
      // Consider mobile if width <= 768 OR mobile user agent
      setIsMobile(width <= 768 || mobileUA);
    };

    checkMobile();

    let timer: ReturnType<typeof setTimeout>;
    const debouncedCheck = () => {
      clearTimeout(timer);
      timer = setTimeout(checkMobile, 150);
    };

    window.addEventListener('resize', debouncedCheck);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', debouncedCheck);
    };
  }, []);

  // While detecting, render the branded splash instead of a blank flash.
  if (isMobile === null) {
    return <PremiumSplashScreen subtitle="טוענים את חוויית האירוע..." />;
  }

  if (!isMobile) {
    return (
      <div className="pj-bg" dir="rtl">
        <div className="pj-stage">
          <div className="pj-shell-header" style={{ marginTop: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/Eventa_Logo.png"
              alt="Eventa"
              className="pj-shell-logo"
              width={92}
              height={92}
              draggable={false}
            />
            <h2 className="pj-shell-brand" style={{ fontSize: 32 }}>Eventa</h2>
          </div>
          <div className="pj-desktop">
            <div className="pj-desktop-icon" aria-hidden="true">📱</div>
            <h1 className="pj-title">Eventa זמינה לנייד בלבד</h1>
            <p className="pj-subtitle">
              כדי להצטרף לחוויית האירוע, סרקו את הקוד דרך הטלפון הנייד.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
