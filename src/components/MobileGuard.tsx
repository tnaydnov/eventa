'use client';

import { useEffect, useState, type ReactNode } from 'react';

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
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile === null) return null;

  if (!isMobile) {
    return (
      <div className="desktop-block">
        <div style={{ fontSize: '72px' }}>📱</div>
        <h1>האפליקציה זמינה לנייד בלבד</h1>
        <p>סרקו את קוד ה-QR מהטלפון הנייד שלכם כדי להיכנס</p>
      </div>
    );
  }

  return <>{children}</>;
}
