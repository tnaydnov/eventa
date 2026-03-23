'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="min-h-screen bg-black flex items-center justify-center p-6" dir="rtl">
      <div className="text-center space-y-6 max-w-sm" role="alert">
        <div className="text-7xl" role="img" aria-label="פרצוף מבולבל">😕</div>
        <h1 className="text-3xl font-bold text-white">
          משהו השתבש
        </h1>
        <p className="text-gray-400 text-lg">
          אירעה שגיאה בלתי צפויה. נסו שוב.
        </p>
        <button
          onClick={reset}
          className="inline-block bg-gradient-to-l from-pink-500 to-rose-500 text-white font-bold py-3 px-8 rounded-2xl text-lg shadow-lg cursor-pointer"
        >
          נסו שוב
        </button>
      </div>
    </main>
  );
}
