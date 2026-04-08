import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — TraceRecap",
  description: "Terms governing your use of TraceRecap.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-stone-700">
      <h1 className="mb-8 text-3xl font-bold text-stone-900">Terms of Service</h1>
      <p className="mb-4 text-sm text-stone-400">Last updated: April 2026</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">1. Acceptance</h2>
          <p>
            By using TraceRecap, you agree to these terms. If you do not agree, please do not use the service.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">2. The Service</h2>
          <p>
            TraceRecap is a browser-based tool for creating travel recap videos from routes and photos.
            The service is provided &quot;as is&quot; without warranty. We may modify or discontinue features at any time.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">3. Your Content</h2>
          <p>
            You retain full ownership of your photos, routes, and exported videos.
            By uploading content, you grant us a limited license to process it for the purpose of providing the service (e.g., rendering, syncing).
            We do not claim ownership of your content and will not use it for other purposes.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Use the service to distribute harmful, illegal, or infringing content</li>
            <li>Attempt to abuse, overload, or interfere with the service infrastructure</li>
            <li>Reverse-engineer or scrape the service beyond normal use</li>
            <li>Create automated accounts or use bots</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">5. Accounts</h2>
          <p>
            Accounts are optional. If you create one, you are responsible for maintaining the security of your credentials.
            You can delete your account at any time from the account menu, which removes your cloud-synced data.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">6. Third-Party Services</h2>
          <p>
            TraceRecap uses Mapbox for maps, Supabase for data storage, and Google for authentication.
            Your use of these services is subject to their respective terms.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">7. Limitation of Liability</h2>
          <p>
            TraceRecap is provided without guarantees of availability, accuracy, or fitness for a particular purpose.
            We are not liable for data loss, service interruptions, or damages arising from your use of the service.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-stone-800">8. Changes</h2>
          <p>
            We may update these terms. Continued use after changes constitutes acceptance.
          </p>
        </div>
      </section>

      <div className="mt-12 border-t border-stone-200 pt-6 text-sm text-stone-400">
        <Link href="/" className="hover:underline">Back to TraceRecap</Link>
        {" · "}
        <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
      </div>
    </main>
  );
}
