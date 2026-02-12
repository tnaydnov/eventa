import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6" dir="rtl">
      <div className="text-center space-y-6 max-w-sm">
        <div className="text-7xl">💔</div>
        <h1 className="text-3xl font-bold text-white">
          הדף לא נמצא
        </h1>
        <p className="text-gray-400 text-lg">
          אופס! נראה שהעמוד שחיפשת לא קיים
        </p>
        <Link
          href="/"
          className="inline-block bg-gradient-to-l from-pink-500 to-rose-500 text-white font-bold py-3 px-8 rounded-2xl text-lg shadow-lg"
        >
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}
