import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Camera,
  Map,
  MonitorPlay,
  PlaneTakeoff,
  Route,
  Share2,
} from "lucide-react";
import { FaqSection } from "@/components/landing/FaqSection";
import { brand } from "@/lib/brand";

/* -------------------------------------------------------------------------- */
/*  Feature steps data                                                        */
/* -------------------------------------------------------------------------- */

const steps = [
  {
    number: 1,
    title: "Drop in your route",
    description:
      "Search cities, drag to reorder, pick transport modes. The map draws itself as you go.",
    bullets: [
      "Drag-and-drop stop reordering",
      "Trains, flights, ferries, drives — pick how you traveled",
      "Smart route smoothing between stops",
    ],
    image: "/landing/step-route.webp",
    imageAlt: "TraceRecap route editor showing stops on a map",
    icon: Route,
  },
  {
    number: 2,
    title: "Attach the moments",
    description:
      "Drop photos onto stops, write captions, choose a layout. Each city becomes a scene.",
    bullets: [
      "Drag photos directly onto map stops",
      "Captions and focal point control",
      "Polaroid, grid, and journal layouts",
    ],
    image: "/landing/step-photos.webp",
    imageAlt: "Photo overlay on the map during editing",
    icon: Camera,
  },
  {
    number: 3,
    title: "Export and share",
    description:
      "Pick a format, hit export. Vertical for Reels, landscape for YouTube, square for posts.",
    bullets: [
      "Platform presets: Instagram, TikTok, YouTube",
      "Browser-native rendering — no extra software",
      "Download as MP4, ready to share",
    ],
    image: "/landing/step-export.webp",
    imageAlt: "Playback preview with export format selector",
    icon: Share2,
  },
] as const;

/* -------------------------------------------------------------------------- */
/*  Trust chips                                                               */
/* -------------------------------------------------------------------------- */

const trustChips = [
  "No sign-up required",
  "Browser-based",
  "Syncs when you sign in",
];

/* -------------------------------------------------------------------------- */
/*  Landing Page                                                              */
/* -------------------------------------------------------------------------- */

export default function LandingPage() {
  return (
    <main
      className="gradient-mesh min-h-screen"
      style={{ fontFamily: brand.fonts.body }}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* ---------------------------------------------------------------- */}
        {/*  Header                                                          */}
        {/* ---------------------------------------------------------------- */}
        <header className="flex items-center justify-between py-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background: brand.gradients.route,
                boxShadow: brand.shadows.md,
              }}
            >
              <PlaneTakeoff className="h-4.5 w-4.5 text-white" />
            </div>
            <span
              className="text-lg font-bold tracking-tight"
              style={{
                color: brand.colors.warm[900],
                fontFamily: brand.fonts.display,
              }}
            >
              TraceRecap
            </span>
          </Link>

          <Link
            href="/editor?demo=true"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:border-[#fdba74] hover:bg-[#fff7ed]"
            style={{
              borderColor: brand.colors.warm[200],
              color: brand.colors.warm[700],
            }}
          >
            <MonitorPlay className="h-4 w-4" />
            Try the demo
          </Link>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/*  Hero                                                            */}
        {/* ---------------------------------------------------------------- */}
        <section className="pb-20 pt-12 sm:pt-20 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1
              className="text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl lg:text-6xl"
              style={{
                color: brand.colors.warm[900],
                fontFamily: brand.fonts.display,
              }}
            >
              Your travels deserve a movie,{" "}
              <span className="gradient-sunset">
                not a forgotten camera roll.
              </span>
            </h1>

            <p
              className="mx-auto mt-6 max-w-xl text-lg leading-relaxed sm:text-xl"
              style={{ color: brand.colors.warm[600] }}
            >
              Build a route, attach your photos, and export a cinematic recap
              — all in the browser.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/editor"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl"
                style={{
                  background: brand.gradients.route,
                  boxShadow: brand.shadows.lg,
                }}
              >
                Create Your First Recap
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/editor?demo=true"
                className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-colors hover:border-[#fdba74] hover:bg-[#fff7ed]"
                style={{
                  borderColor: brand.colors.warm[200],
                  color: brand.colors.warm[700],
                }}
              >
                <MonitorPlay className="h-4 w-4" />
                Watch Demo
              </Link>
            </div>

            {/* Trust chips */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs" style={{ color: brand.colors.warm[400] }}>
              {trustChips.map((chip, i) => (
                <span key={chip} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden>·</span>}
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* Hero screenshot with micro-animations */}
          <div className="landing-animate-in mt-12 sm:mt-16">
            <div
              className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border"
              style={{
                borderColor: brand.colors.warm[200],
                boxShadow: brand.shadows.xl,
              }}
            >
              <Image
                src="/landing/hero.webp"
                alt="TraceRecap editor with a travel route on the map"
                width={1280}
                height={800}
                className="w-full"
                priority
              />
              {/* Animated overlay: route line drawing effect */}
              <svg
                className="landing-route-draw pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 1280 800"
                fill="none"
                aria-hidden
              >
                <path
                  d="M200,400 C400,300 600,350 800,280 S1000,320 1100,350"
                  stroke="url(#routeGrad)"
                  strokeWidth="3"
                  strokeDasharray="8 6"
                  strokeLinecap="round"
                  opacity="0.6"
                />
                <defs>
                  <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={brand.colors.primary[500]} />
                    <stop offset="100%" stopColor={brand.colors.ocean[500]} />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*  Features — 3-step flow                                          */}
        {/* ---------------------------------------------------------------- */}
        <section id="features" className="pb-20">
          <div className="mx-auto max-w-3xl text-center">
            <p
              className="text-sm tracking-[0.2em] uppercase"
              style={{ color: brand.colors.primary[600] }}
            >
              How it works
            </p>
            <h2
              className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl"
              style={{
                color: brand.colors.warm[900],
                fontFamily: brand.fonts.display,
              }}
            >
              Three steps from route to recap.
            </h2>
          </div>

          <div className="mt-16 space-y-20 lg:space-y-28">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const reversed = i % 2 === 1;

              return (
                <div
                  key={step.number}
                  className={`landing-animate-in flex flex-col items-center gap-8 lg:flex-row lg:gap-12 ${
                    reversed ? "lg:flex-row-reverse" : ""
                  }`}
                >
                  {/* Text */}
                  <div className="flex-1 lg:max-w-md">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                        style={{
                          background: brand.gradients.route,
                          boxShadow: brand.shadows.md,
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span
                        className="text-sm font-semibold tracking-wide uppercase"
                        style={{ color: brand.colors.primary[600] }}
                      >
                        Step {step.number}
                      </span>
                    </div>

                    <h3
                      className="mt-4 text-2xl font-semibold sm:text-3xl"
                      style={{
                        color: brand.colors.warm[900],
                        fontFamily: brand.fonts.display,
                      }}
                    >
                      {step.title}
                    </h3>

                    <p
                      className="mt-3 text-base leading-relaxed"
                      style={{ color: brand.colors.warm[600] }}
                    >
                      {step.description}
                    </p>

                    <ul className="mt-4 space-y-2">
                      {step.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex items-start gap-2 text-sm"
                          style={{ color: brand.colors.warm[500] }}
                        >
                          <Map
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: brand.colors.ocean[500] }}
                          />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Screenshot */}
                  <div className="flex-1">
                    <div
                      className="overflow-hidden rounded-2xl border"
                      style={{
                        borderColor: brand.colors.warm[200],
                        boxShadow: brand.shadows.lg,
                      }}
                    >
                      <Image
                        src={step.image}
                        alt={step.imageAlt}
                        width={640}
                        height={400}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trip type breadth */}
          <p
            className="mx-auto mt-16 max-w-2xl text-center text-sm leading-relaxed"
            style={{ color: brand.colors.warm[400] }}
          >
            Works for backpacking trips, road trips, food tours, city walks,
            and any journey with a route.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*  FAQ                                                             */}
        {/* ---------------------------------------------------------------- */}
        <FaqSection />

        {/* ---------------------------------------------------------------- */}
        {/*  Footer                                                          */}
        {/* ---------------------------------------------------------------- */}
        <footer className="mt-24 border-t pb-12 pt-10 sm:mt-28" style={{ borderColor: brand.colors.warm[200] }}>
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-between">
            {/* Logo + tagline */}
            <div>
              <Link href="/" className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: brand.gradients.route }}
                >
                  <PlaneTakeoff className="h-4 w-4 text-white" />
                </div>
                <span
                  className="text-base font-bold tracking-tight"
                  style={{
                    color: brand.colors.warm[900],
                    fontFamily: brand.fonts.display,
                  }}
                >
                  TraceRecap
                </span>
              </Link>
              <p
                className="mt-2 max-w-xs text-sm leading-relaxed"
                style={{ color: brand.colors.warm[400] }}
              >
                Turn your travels into cinematic recaps — in the browser.
              </p>
            </div>

            {/* Links */}
            <div className="flex gap-12 text-sm" style={{ color: brand.colors.warm[500] }}>
              <div className="space-y-2">
                <p className="font-semibold" style={{ color: brand.colors.warm[700] }}>Product</p>
                <Link href="/editor" className="block hover:underline">Editor</Link>
                <Link href="/editor?demo=true" className="block hover:underline">Live Demo</Link>
              </div>
              <div className="space-y-2">
                <p className="font-semibold" style={{ color: brand.colors.warm[700] }}>Resources</p>
                <a href="#features" className="block hover:underline">Features</a>
                <a href="#faq" className="block hover:underline">FAQ</a>
              </div>
            </div>
          </div>

          {/* Trust chips + copyright */}
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {["No sign-up required", "Browser-based", "Powered by Mapbox"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border px-3 py-1 text-xs"
                  style={{
                    borderColor: brand.colors.warm[200],
                    color: brand.colors.warm[400],
                    backgroundColor: "rgba(255,255,255,0.6)",
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
