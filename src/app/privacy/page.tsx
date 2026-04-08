import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — TraceRecap",
  description: "How TraceRecap handles your data, cookies, and privacy.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-stone-700">
      <h1 className="mb-8 text-3xl font-bold text-stone-900">Privacy Policy</h1>
      <p className="mb-4 text-sm text-stone-400">Last updated: April 2026</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">1. What We Collect</h2>
          <p>
            <strong>Account data:</strong> If you sign in, we store your email address and authentication tokens via Supabase.
            Google OAuth users share their name and profile picture as provided by Google.
          </p>
          <p className="mt-2">
            <strong>Project data:</strong> Routes, photos, and settings you create are stored locally in your browser (IndexedDB).
            If signed in, projects sync to our cloud database hosted on Supabase.
          </p>
          <p className="mt-2">
            <strong>Analytics:</strong> With your consent, we use PostHog to collect anonymous usage events (e.g., feature clicks, export counts).
            We do not record session replays unless you explicitly opt in. No personally identifiable information is sent to PostHog.
          </p>
          <p className="mt-2">
            <strong>Performance:</strong> Vercel Analytics and Speed Insights collect anonymous page-load metrics.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">2. Cookies &amp; Local Storage</h2>
          <p>
            We use cookies for authentication session management (Supabase auth tokens).
            Analytics cookies are only set after you accept the cookie consent banner.
            We store your project data and preferences in IndexedDB and localStorage.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">3. Third-Party Services</h2>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>Supabase</strong> — Authentication and cloud data storage</li>
            <li><strong>Mapbox</strong> — Map rendering and geocoding</li>
            <li><strong>Google</strong> — OAuth sign-in (optional)</li>
            <li><strong>PostHog</strong> — Product analytics (consent-gated)</li>
            <li><strong>Vercel</strong> — Hosting, analytics, and performance monitoring</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">4. Your Rights</h2>
          <p>You can:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Use TraceRecap without creating an account</li>
            <li>Decline analytics cookies via the consent banner</li>
            <li>Export your project data as a JSON file from the editor</li>
            <li>Delete your account and all cloud data from the account menu</li>
            <li>Request data deletion by contacting us</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">5. Data Retention</h2>
          <p>
            Local data persists until you clear your browser storage.
            Cloud data is retained while your account is active and deleted upon account deletion.
            Anonymous analytics data is retained for 12 months.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">6. Security</h2>
          <p>
            All data in transit is encrypted via HTTPS. Cloud data is stored in Supabase with row-level security.
            We do not sell or share your data with third parties for advertising purposes.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">7. Changes</h2>
          <p>
            We may update this policy. Material changes will be noted with an updated date at the top.
          </p>
        </div>
      </section>

      <div className="mt-12 border-t border-stone-200 pt-6 text-sm text-stone-400">
        <Link href="/" className="hover:underline">Back to TraceRecap</Link>
        {" · "}
        <Link href="/terms" className="hover:underline">Terms of Service</Link>
      </div>
    </main>
  );
}
