import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MonitorPlay, PlaneTakeoff } from "lucide-react";
import { FaqSection } from "@/components/landing/FaqSection";
import { brand } from "@/lib/brand";
import { HeroCarousel } from "@/components/landing/HeroCarousel";

export default function LandingPage() {
  return (
    <main
      className="gradient-mesh min-h-screen"
      style={{ fontFamily: brand.fonts.body }}
    >
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        {/* Header */}
        <header className="flex items-center justify-between py-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: brand.gradients.route, boxShadow: brand.shadows.md }}
            >
              <PlaneTakeoff className="h-4.5 w-4.5 text-white" />
            </div>
            <span
              className="text-lg font-bold tracking-tight"
              style={{ color: brand.colors.warm[900], fontFamily: brand.fonts.display }}
            >
              TraceRecap
            </span>
          </Link>
          <Link
            href="/editor?demo=true"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:border-[#fdba74] hover:bg-[#fff7ed]"
            style={{ borderColor: brand.colors.warm[200], color: brand.colors.warm[700] }}
          >
            <MonitorPlay className="h-4 w-4" />
            Try the demo
          </Link>
        </header>

        {/* Hero */}
        <section className="pb-24 pt-16 sm:pt-24 lg:pt-32">
          <div className="mx-auto max-w-2xl text-center">
            <p
              className="text-sm tracking-[0.25em] uppercase"
              style={{ color: brand.colors.primary[500], fontFamily: brand.fonts.display }}
            >
              for travelers who create
            </p>

            <h1
              className="mt-6 text-[2.75rem] leading-[1.05] font-bold tracking-tight sm:text-6xl lg:text-7xl"
              style={{ color: brand.colors.warm[900], fontFamily: brand.fonts.display }}
            >
              Your travels
              <br />
              deserve a{" "}
              <span className="gradient-sunset">movie.</span>
            </h1>

            <p
              className="mx-auto mt-6 max-w-md text-base leading-relaxed sm:text-lg"
              style={{ color: brand.colors.warm[500] }}
            >
              Build a route. Attach your photos.
              <br />
              Export a cinematic recap — all in the browser.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/editor"
                className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-xl"
                style={{ background: brand.gradients.route, boxShadow: brand.shadows.lg }}
              >
                Create Your First Recap
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/editor?demo=true"
                className="inline-flex items-center gap-2 rounded-full border px-7 py-3.5 text-sm font-semibold transition-colors hover:border-[#fdba74] hover:bg-[#fff7ed]"
                style={{ borderColor: brand.colors.warm[200], color: brand.colors.warm[600] }}
              >
                <MonitorPlay className="h-4 w-4" />
                Watch Demo
              </Link>
            </div>

            <div className="mt-5 flex items-center justify-center gap-4 text-xs" style={{ color: brand.colors.warm[400] }}>
              <span>No sign-up required</span>
              <span aria-hidden>·</span>
              <span>Browser-based</span>
              <span aria-hidden>·</span>
              <span>Syncs when you sign in</span>
            </div>
          </div>

          {/* Hero carousel — auto-rotating showcase */}
          <div className="landing-animate-in mt-16 sm:mt-20">
            <HeroCarousel />
          </div>

          {/* Gentle caption under the screenshots */}
          <p
            className="mx-auto mt-8 max-w-lg text-center text-sm italic leading-relaxed"
            style={{ color: brand.colors.warm[400], fontFamily: brand.fonts.handwritten, fontSize: "1.1rem" }}
          >
            Backpacking trips, road trips, food tours, city walks — any journey with a route.
          </p>
        </section>

        {/* FAQ */}
        <FaqSection />

        {/* Footer */}
        <footer className="mt-28 border-t pb-12 pt-10" style={{ borderColor: brand.colors.warm[200] }}>
          <div className="flex flex-col items-center gap-6 text-center">
            <Link href="/" className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: brand.gradients.route }}
              >
                <PlaneTakeoff className="h-3.5 w-3.5 text-white" />
              </div>
              <span
                className="text-sm font-bold tracking-tight"
                style={{ color: brand.colors.warm[900], fontFamily: brand.fonts.display }}
              >
                TraceRecap
              </span>
            </Link>

            <div className="flex items-center gap-5 text-sm" style={{ color: brand.colors.warm[500] }}>
              <Link href="/editor" className="hover:underline">Editor</Link>
              <Link href="/editor?demo=true" className="hover:underline">Demo</Link>
              <a href="#faq" className="hover:underline">FAQ</a>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {["No sign-up required", "Browser-based", "Powered by Mapbox"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border px-3 py-1 text-[11px]"
                  style={{
                    borderColor: brand.colors.warm[200],
                    color: brand.colors.warm[400],
                    backgroundColor: "rgba(255,255,255,0.5)",
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>

            <p className="text-xs" style={{ color: brand.colors.warm[300] }}>
              © {new Date().getFullYear()} TraceRecap
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
