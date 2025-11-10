'use client';
export const dynamic = 'force-dynamic';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-center px-4">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Seite nicht gefunden</h1>
        <p className="text-gray-600 mb-6">Die angeforderte Seite existiert nicht.</p>
        <a href="/" className="text-blue-600 hover:underline">Zurück zur Startseite</a>
      </div>
    </div>
  );
}
