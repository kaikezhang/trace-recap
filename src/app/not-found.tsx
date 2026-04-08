import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-8xl font-bold text-stone-200">404</h1>
      <p className="mt-4 text-lg text-stone-600">Page not found.</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
      >
        Back to TraceRecap
      </Link>
    </main>
  );
}
