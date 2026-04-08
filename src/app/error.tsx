"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-6xl font-bold text-stone-300">Oops</h1>
      <p className="mt-4 text-lg text-stone-600">Something went wrong.</p>
      {error.digest && (
        <p className="mt-2 text-xs text-stone-400">Error ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
      >
        Try again
      </button>
    </main>
  );
}
