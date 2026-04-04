import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CircleCheck,
  Clapperboard,
  Globe,
  Heart,
  Mail,
  MapPin,
  MessageCircleMore,
  MonitorPlay,
  Mountain,
  Music2,
  Navigation,
  PlaneTakeoff,
  Route,
  Sparkles,
  Stamp,
  TicketsPlane,
  Waypoints,
} from "lucide-react";
import { FeatureShowcase } from "@/components/landing/FeatureShowcase";
import { FaqSection } from "@/components/landing/FaqSection";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

const socialBadges = [
  { label: "Powered by Mapbox", icon: Globe },
  { label: "Built with Next.js", icon: Sparkles },
  { label: "Works on all browsers", icon: CircleCheck },
] as const;

const platforms = [
  { label: "Instagram", icon: Camera },
  { label: "TikTok", icon: Music2 },
  { label: "YouTube", icon: MonitorPlay },
  { label: "WeChat", icon: MessageCircleMore },
] as const;

const steps = [
  {
    number: "01",
    title: "Drop in your route",
    description:
      "Pick the cities, reorder the stops, and choose how each leg should travel.",
    label: "Cities + modes",
  },
  {
    number: "02",
    title: "Attach the moments",
    description:
      "Layer photos, notes, and timing cues so the route reveals the emotional beats.",
    label: "Photos + captions",
  },
  {
    number: "03",
    title: "Export the recap",
    description:
      "Render once and post everywhere from vertical reels to widescreen trip films.",
    label: "MP4 + social presets",
  },
] as const;

const useCases = [
  {
    title: "Europe Backpacking",
    meta: "11 cities • trains + flights",
    height: "min-h-[310px]",
    span: "lg:col-span-3",
    tone: "sunset",
  },
  {
    title: "Road Trip USA",
    meta: "coastline mileage + roadside stops",
    height: "min-h-[260px]",
    span: "lg:col-span-2 lg:mt-10",
    tone: "ocean",
  },
  {
    title: "Asia Food Tour",
    meta: "markets, kitchens, midnight snacks",
    height: "min-h-[340px]",
    span: "lg:col-span-2 lg:-mt-8",
    tone: "sand",
  },
  {
    title: "City Walking Tour",
    meta: "districts, coffee stops, museum cuts",
    height: "min-h-[240px]",
    span: "lg:col-span-3 lg:-mt-4",
    tone: "warm",
  },
] as const;

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Editor", href: "/editor" },
      { label: "Live Demo", href: "/editor?demo=true" },
      { label: "Feature Tour", href: "#features" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "How It Works", href: "#how-it-works" },
      { label: "Use Cases", href: "#gallery" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "GitHub", href: "https://github.com" },
      { label: "Twitter / X", href: "https://x.com" },
      { label: "Mapbox", href: "https://www.mapbox.com" },
    ],
  },
] as const;

export function LandingPage() {
  return (
    <main className="gradient-mesh overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1440px] px-5 pb-8 pt-6 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-[18px]"
              style={{
                background: brand.gradients.route,
                color: brand.colors.warm[50],
                boxShadow: brand.shadows.lg,
              }}
            >
              <PlaneTakeoff className="h-5 w-5" />
            </span>
            <div>
              <p
                className="text-lg font-semibold tracking-tight"
                style={{ color: brand.colors.warm[900] }}
              >
                TraceRecap
              </p>
              <p
                className="text-xs"
                style={{ color: brand.colors.warm[500] }}
              >
                travel route films from a browser tab
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="#features"
              className="hidden rounded-full px-4 py-2 text-sm sm:inline-flex"
              style={{
                color: brand.colors.warm[700],
                backgroundColor: "rgba(255,255,255,0.72)",
                border: `1px solid ${brand.colors.warm[200]}`,
              }}
            >
              Preview the flow
            </Link>
            <Link
              href="/editor?demo=true"
              className="inline-flex items-center gap-2 rounded-[18px] px-4 py-2.5 text-sm font-medium"
              style={{
                color: brand.colors.primary[700],
                backgroundColor: brand.colors.primary[50],
                border: `1px solid ${brand.colors.primary[100]}`,
              }}
            >
              Watch Demo
            </Link>
          </div>
        </header>

        <section className="relative pb-10 pt-10 sm:pb-16 sm:pt-14 lg:pb-20 lg:pt-20">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(520px,1fr)] lg:gap-8 xl:gap-12">
            <div className="relative max-w-[620px] lg:pt-10 xl:pl-8">
              <p
                className="text-xl sm:text-2xl"
                style={{
                  color: brand.colors.primary[600],
                  fontFamily: brand.fonts.handwritten,
                }}
              >
                for travelers who want the memory to move
              </p>
              <h1
                className="mt-3 text-[2.9rem] leading-[0.92] font-semibold tracking-[-0.06em] sm:text-[4.5rem] lg:text-[5.5rem]"
                style={{ color: brand.colors.warm[900], fontFamily: brand.fonts.display }}
              >
                Your travels deserve a movie,
                <span
                  className="mt-2 block max-w-[11ch] text-[0.82em] leading-[0.94]"
                  style={{ color: brand.colors.primary[600] }}
                >
                  not another forgotten camera roll.
                </span>
              </h1>
              <p
                className="mt-7 max-w-xl text-lg leading-8 sm:text-xl"
                style={{ color: brand.colors.warm[600] }}
              >
                TraceRecap turns routes, photos, and transport legs into travel
                videos that feel hand-cut instead of auto-generated. Build one
                in minutes, then post it anywhere.
              </p>

              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/editor"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold sm:px-7"
                  style={{
                    color: brand.colors.warm[50],
                    backgroundColor: brand.colors.primary[500],
                    boxShadow: brand.shadows.lg,
                  }}
                >
                  Create Your First Recap
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/editor?demo=true"
                  className="inline-flex items-center gap-2 rounded-[18px] border px-5 py-3 text-sm font-medium"
                  style={{
                    color: brand.colors.warm[800],
                    borderColor: brand.colors.warm[300],
                    backgroundColor: "rgba(255,255,255,0.72)",
                  }}
                >
                  <MonitorPlay className="h-4 w-4" />
                  Watch Demo
                </Link>
              </div>

              <div className="mt-9 flex flex-wrap gap-4">
                <StatCard
                  value="48 sec"
                  label="average first recap"
                  rotate="-2deg"
                />
                <StatCard
                  value="7 stops"
                  label="turn into one smooth arc"
                  rotate="1.5deg"
                  teal
                />
              </div>

              <div
                className="mt-10 max-w-sm rounded-[24px] border px-4 py-4 sm:ml-10"
                style={{
                  borderColor: brand.colors.sand[200],
                  backgroundColor: "rgba(255,250,224,0.82)",
                  boxShadow: brand.shadows.md,
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 flex h-10 w-10 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: brand.colors.sand[400],
                      color: brand.colors.warm[900],
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: brand.colors.warm[900] }}
                    >
                      Story beats over timelines
                    </p>
                    <p
                      className="mt-1 text-sm leading-6"
                      style={{ color: brand.colors.warm[700] }}
                    >
                      Build from the trip outward: the ferry crossing, the
                      missed train, the perfect dinner, the last sunrise.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative lg:pl-6">
              <FloatingMemento
                className="-left-2 top-4 rotate-[-10deg] lg:-left-12"
                title="passport stamp"
                icon={Stamp}
                tone="sand"
              />
              <FloatingMemento
                className="right-4 top-0 rotate-[12deg] lg:right-2"
                title="boarding pass"
                icon={TicketsPlane}
                tone="primary"
              />
              <FloatingMemento
                className="bottom-14 -left-1 rotate-[8deg] lg:-left-10"
                title="route pin"
                icon={MapPin}
                tone="ocean"
              />
              <HeroMapDemo />
            </div>
          </div>
        </section>

        <section className="mt-4 sm:mt-2">
          <div
            className="grid gap-5 border px-4 py-5 sm:px-6 lg:grid-cols-[1.2fr_0.85fr]"
            style={{
              borderColor: brand.colors.warm[200],
              borderRadius: "28px 18px 30px 20px",
              backgroundColor: "rgba(255,255,255,0.72)",
              boxShadow: brand.shadows.md,
            }}
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p
                  className="text-sm tracking-[0.22em] uppercase"
                  style={{ color: brand.colors.warm[500] }}
                >
                  Social Proof
                </p>
                <div className="mt-3 flex items-end gap-4">
                  <span
                    className="text-4xl font-semibold sm:text-5xl"
                    style={{ color: brand.colors.primary[600], fontFamily: brand.fonts.display }}
                  >
                    48,000+
                  </span>
                  <p
                    className="max-w-sm pb-1 text-sm leading-6 sm:text-base"
                    style={{ color: brand.colors.warm[700] }}
                  >
                    travelers have already mapped a journey they wanted to keep.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {socialBadges.map(({ label, icon: Icon }, index) => (
                  <span
                    key={label}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm",
                      index === 1 ? "rounded-[16px]" : "rounded-full",
                    )}
                    style={{
                      color: brand.colors.warm[700],
                      backgroundColor:
                        index === 0
                          ? brand.colors.primary[50]
                          : index === 1
                            ? brand.colors.ocean[50]
                            : brand.colors.warm[50],
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              {platforms.map(({ label, icon: Icon }, index) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs"
                  style={{
                    color: brand.colors.warm[800],
                    backgroundColor: "rgba(255,255,255,0.9)",
                    border: `1px solid ${
                      index % 2 === 0 ? brand.colors.warm[200] : brand.colors.primary[100]
                    }`,
                    borderRadius: index === 1 ? "18px" : "999px",
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <FeatureShowcase />

        <section id="how-it-works" className="mt-24 sm:mt-28 lg:mt-36">
          <div className="max-w-3xl">
            <p
              className="text-sm tracking-[0.24em] uppercase"
              style={{ color: brand.colors.primary[700] }}
            >
              How It Works
            </p>
            <h2
              className="mt-4 text-4xl leading-[0.96] font-semibold sm:text-5xl"
              style={{ color: brand.colors.warm[900], fontFamily: brand.fonts.display }}
            >
              Three moves, connected like a route instead of stacked like a checklist.
            </h2>
          </div>

          <div className="relative mt-12">
            <div
              className="absolute bottom-0 left-8 top-8 w-[3px] lg:left-0 lg:right-0 lg:top-[58px] lg:h-[3px] lg:w-auto"
              style={{
                background: "linear-gradient(180deg, #f97316 0%, #14b8a6 100%)",
              }}
            />

            <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
              {steps.map((step, index) => (
                <article
                  key={step.number}
                  className={cn(
                    "relative pl-20 lg:pl-0",
                    index === 1 && "lg:pt-14",
                    index === 2 && "lg:pt-6",
                  )}
                >
                  <div className="absolute left-0 top-0 lg:relative lg:left-auto lg:top-auto lg:mb-6">
                    <PinNumber number={step.number} />
                  </div>

                  <div
                    className="overflow-hidden border px-5 py-5"
                    style={{
                      borderColor: brand.colors.warm[200],
                      backgroundColor: "rgba(255,255,255,0.8)",
                      borderRadius:
                        index === 0
                          ? "28px 20px 24px 22px"
                          : index === 1
                            ? "20px 28px 22px 26px"
                            : "24px 18px 30px 20px",
                      boxShadow: brand.shadows.md,
                    }}
                  >
                    <p
                      className="text-xs tracking-[0.2em] uppercase"
                      style={{ color: brand.colors.primary[700] }}
                    >
                      {step.label}
                    </p>
                    <h3
                      className="mt-3 text-2xl leading-[1.02] font-semibold"
                      style={{
                        color: brand.colors.warm[900],
                        fontFamily: brand.fonts.display,
                      }}
                    >
                      {step.title}
                    </h3>
                    <p
                      className="mt-3 text-sm leading-7 sm:text-base"
                      style={{ color: brand.colors.warm[600] }}
                    >
                      {step.description}
                    </p>

                    <MiniShot index={index} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="gallery" className="mt-24 sm:mt-28 lg:mt-36">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p
                className="text-sm tracking-[0.24em] uppercase"
                style={{ color: brand.colors.primary[700] }}
              >
                Gallery / Use Cases
              </p>
              <h2
                className="mt-4 text-4xl leading-[0.96] font-semibold sm:text-5xl"
                style={{ color: brand.colors.warm[900], fontFamily: brand.fonts.display }}
              >
                Not every trip moves the same way, so the examples should not all look alike either.
              </h2>
            </div>
            <p
              className="max-w-md text-sm leading-7 sm:text-base"
              style={{ color: brand.colors.warm[600] }}
            >
              Backpacking, food routes, long drives, and city walks all need a
              different rhythm. The gallery sells that flexibility visually.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-5">
            {useCases.map((card, index) => (
              <UseCaseCard key={card.title} index={index} {...card} />
            ))}
          </div>
        </section>

        <FaqSection />

        <footer className="mt-24 pb-10 sm:mt-28 lg:mt-36">
          <div
            className="border px-5 py-8 sm:px-7 lg:px-8 lg:py-10"
            style={{
              borderColor: brand.colors.primary[100],
              backgroundColor: "rgba(249,115,22,0.06)",
              borderRadius: "32px 24px 30px 22px",
            }}
          >
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
              <div className="max-w-md">
                <p
                  className="text-xl"
                  style={{
                    color: brand.colors.primary[600],
                    fontFamily: brand.fonts.handwritten,
                  }}
                >
                  Keep the route. Keep the feeling.
                </p>
                <h2
                  className="mt-3 text-3xl leading-[0.98] font-semibold sm:text-4xl"
                  style={{ color: brand.colors.warm[900], fontFamily: brand.fonts.display }}
                >
                  Built with <Heart className="mx-1 inline h-5 w-5 align-[-2px]" /> for travelers everywhere.
                </h2>
                <p
                  className="mt-4 text-base leading-7"
                  style={{ color: brand.colors.warm[600] }}
                >
                  Join the mailing list for launches, editor improvements, and
                  new recap presets built around real trips.
                </p>

                <form className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Mail
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: brand.colors.warm[400] }}
                    />
                    <input
                      type="email"
                      placeholder="you@somewhere-between-flights.com"
                      className="h-12 w-full rounded-[18px] border pl-11 pr-4 text-sm outline-none transition"
                      style={{
                        borderColor: brand.colors.warm[200],
                        backgroundColor: "rgba(255,255,255,0.9)",
                        color: brand.colors.warm[900],
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold"
                    style={{
                      color: brand.colors.warm[50],
                      backgroundColor: brand.colors.primary[500],
                      boxShadow: brand.shadows.md,
                    }}
                  >
                    Join newsletter
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
                {footerColumns.map((column) => (
                  <div key={column.title}>
                    <h3
                      className="text-sm font-semibold tracking-[0.2em] uppercase"
                      style={{ color: brand.colors.warm[700] }}
                    >
                      {column.title}
                    </h3>
                    <div className="mt-4 space-y-3">
                      {column.links.map((link) => (
                        <Link
                          key={link.label}
                          href={link.href}
                          className="flex min-h-[44px] items-center text-sm transition-opacity hover:opacity-80 sm:min-h-0"
                          style={{ color: brand.colors.warm[600] }}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}

                <div>
                  <h3
                    className="text-sm font-semibold tracking-[0.2em] uppercase"
                    style={{ color: brand.colors.warm[700] }}
                  >
                    Around the corner
                  </h3>
                  <div className="mt-4 space-y-3 text-sm" style={{ color: brand.colors.warm[600] }}>
                    <p>Route presets for honeymoon edits</p>
                    <p>Smarter chapter pacing for long itineraries</p>
                    <p>Shared project links for travel partners</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

function HeroMapDemo() {
  return (
    <div className="relative pt-6 sm:pt-10">
      <div
        className="relative overflow-hidden border px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5"
        style={{
          borderColor: brand.colors.warm[200],
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,247,237,0.58) 100%)",
          borderRadius: "34px 24px 30px 20px",
          boxShadow: brand.shadows.xl,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-[16px]"
              style={{
                backgroundColor: brand.colors.primary[500],
                color: brand.colors.warm[50],
              }}
            >
              <Clapperboard className="h-5 w-5" />
            </span>
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: brand.colors.warm[900] }}
              >
                Route recap in progress
              </p>
              <p className="text-xs" style={{ color: brand.colors.warm[500] }}>
                from Porto sunsets to Cappadocia dawns
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs"
              style={{
                color: brand.colors.ocean[800],
                backgroundColor: brand.colors.ocean[50],
              }}
            >
              05 cities
            </span>
            <span
              className="rounded-full px-3 py-1 text-xs"
              style={{
                color: brand.colors.primary[700],
                backgroundColor: brand.colors.primary[50],
              }}
            >
              00:42 runtime
            </span>
          </div>
        </div>

        <div className="relative mt-5 min-h-[380px] overflow-hidden rounded-[28px] border sm:min-h-[560px] lg:min-h-[640px]">
          <div
            className="absolute inset-0"
            style={{
              borderColor: brand.colors.warm[200],
              background:
                "radial-gradient(circle at 20% 20%, rgba(249,115,22,0.14), transparent 24%), radial-gradient(circle at 78% 16%, rgba(20,184,166,0.12), transparent 22%), radial-gradient(circle at 52% 78%, rgba(234,179,8,0.12), transparent 20%), linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,251,245,0.94) 100%)",
            }}
          />
          <div
            className="absolute inset-4 rounded-[22px]"
            style={{
              border: `1px dashed ${brand.colors.warm[200]}`,
            }}
          />
          <svg
            viewBox="0 0 920 640"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="hero-route-gradient" x1="108" y1="512" x2="734" y2="108">
                <stop stopColor={brand.colors.primary[500]} />
                <stop offset="0.52" stopColor={brand.colors.sand[500]} />
                <stop offset="1" stopColor={brand.colors.ocean[500]} />
              </linearGradient>
            </defs>
            <path
              d="M122 510C194 468 230 302 310 286C396 268 430 434 518 414C594 396 606 222 690 196C760 174 786 136 812 98"
              fill="none"
              stroke="url(#hero-route-gradient)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray="22 18"
            >
              <animate
                attributeName="stroke-dashoffset"
                values="0;-80"
                dur="6s"
                repeatCount="indefinite"
              />
            </path>
            {[
              { x: 122, y: 510, color: brand.colors.primary[500] },
              { x: 310, y: 286, color: brand.colors.sand[500] },
              { x: 518, y: 414, color: brand.colors.primary[300] },
              { x: 690, y: 196, color: brand.colors.ocean[400] },
              { x: 812, y: 98, color: brand.colors.ocean[500] },
            ].map((stop) => (
              <g key={`${stop.x}-${stop.y}`}>
                <circle cx={stop.x} cy={stop.y} r="20" fill="#fff" />
                <circle cx={stop.x} cy={stop.y} r="10" fill={stop.color} />
              </g>
            ))}
            <circle cx="518" cy="414" r="24" fill="rgba(249,115,22,0.14)">
              <animate attributeName="r" values="14;24;14" dur="3.2s" repeatCount="indefinite" />
              <animate
                attributeName="opacity"
                values="0.9;0.2;0.9"
                dur="3.2s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>

          {[
            { label: "Porto", left: "10%", top: "73%" },
            { label: "Milan", left: "31%", top: "32%" },
            { label: "Dubrovnik", left: "52%", top: "57%" },
            { label: "Istanbul", left: "72%", top: "24%" },
            { label: "Cappadocia", right: "7%", top: "10%" },
          ].map((city, index) => (
            <span
              key={city.label}
              className="absolute hidden rounded-full px-3 py-1 text-xs font-medium min-[480px]:block sm:text-sm"
              style={{
                ...city,
                color: brand.colors.warm[700],
                backgroundColor: "rgba(255,255,255,0.92)",
                transform: `rotate(${index % 2 === 0 ? -3 : 4}deg)`,
                boxShadow: brand.shadows.md,
              }}
            >
              {city.label}
            </span>
          ))}

          <div
            className="absolute left-[17%] top-[23%] hidden rounded-[18px] border px-3 py-2 sm:block"
            style={{
              borderColor: brand.colors.primary[100],
              backgroundColor: "rgba(255,247,237,0.94)",
              boxShadow: brand.shadows.md,
            }}
          >
            <div className="flex items-center gap-2 text-xs">
              <PlaneTakeoff
                className="h-3.5 w-3.5"
                style={{ color: brand.colors.primary[600] }}
              />
              <span style={{ color: brand.colors.warm[700] }}>
                flight segment
              </span>
            </div>
          </div>

          <div
            className="absolute left-[56%] top-[28%] hidden rounded-[18px] border px-3 py-2 sm:block"
            style={{
              borderColor: brand.colors.ocean[100],
              backgroundColor: "rgba(240,253,250,0.94)",
              boxShadow: brand.shadows.md,
            }}
          >
            <div className="flex items-center gap-2 text-xs">
              <Navigation
                className="h-3.5 w-3.5"
                style={{ color: brand.colors.ocean[700] }}
              />
              <span style={{ color: brand.colors.warm[700] }}>
                2 photo moments queued
              </span>
            </div>
          </div>

          <div
            className="absolute bottom-5 left-4 right-4 rounded-[26px] border px-4 py-4 sm:left-6 sm:right-6 sm:px-5"
            style={{
              borderColor: brand.colors.warm[200],
              backgroundColor: "rgba(255,255,255,0.9)",
              boxShadow: brand.shadows.lg,
            }}
          >
            <div className="flex flex-wrap items-center gap-4">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  backgroundColor: brand.colors.primary[500],
                  color: brand.colors.warm[50],
                }}
              >
                <Route className="h-5 w-5" />
              </span>
              <div className="min-w-[160px] flex-1">
                <div
                  className="h-2.5 rounded-full"
                  style={{ backgroundColor: brand.colors.warm[100] }}
                >
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      width: "68%",
                      background: brand.gradients.route,
                    }}
                  />
                </div>
                <div
                  className="mt-2 flex items-center justify-between text-xs"
                  style={{ color: brand.colors.warm[500] }}
                >
                  <span>Building scene 03</span>
                  <span>00:28 / 00:42</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <TinyTag icon={MapPin} label="Map sync" />
                <TinyTag icon={Waypoints} label="Photo cues" teal />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingMemento({
  className,
  title,
  icon: Icon,
  tone,
}: {
  className: string;
  title: string;
  icon: typeof MapPin;
  tone: "primary" | "ocean" | "sand";
}) {
  const toneMap = {
    primary: {
      bg: brand.colors.primary[50],
      border: brand.colors.primary[100],
      icon: brand.colors.primary[700],
    },
    ocean: {
      bg: brand.colors.ocean[50],
      border: brand.colors.ocean[100],
      icon: brand.colors.ocean[700],
    },
    sand: {
      bg: brand.colors.sand[50],
      border: brand.colors.sand[100],
      icon: brand.colors.sand[700],
    },
  }[tone];

  return (
    <div
      className={cn("absolute z-10 hidden sm:block", className)}
      style={{
        backgroundColor: toneMap.bg,
        border: `1px solid ${toneMap.border}`,
        borderRadius: "18px",
        boxShadow: brand.shadows.md,
      }}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: "#fff", color: toneMap.icon }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p
            className="text-[11px] tracking-[0.18em] uppercase"
            style={{ color: brand.colors.warm[500] }}
          >
            travel object
          </p>
          <p className="text-sm" style={{ color: brand.colors.warm[800] }}>
            {title}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  rotate,
  teal = false,
}: {
  value: string;
  label: string;
  rotate: string;
  teal?: boolean;
}) {
  return (
    <div
      className="border px-4 py-3"
      style={{
        transform: `rotate(${rotate})`,
        borderColor: teal ? brand.colors.ocean[100] : brand.colors.primary[100],
        backgroundColor: teal ? "rgba(240,253,250,0.88)" : "rgba(255,247,237,0.88)",
        borderRadius: teal ? "18px 24px 20px 18px" : "24px 18px 18px 22px",
        boxShadow: brand.shadows.sm,
      }}
    >
      <p
        className="text-2xl font-semibold"
        style={{
          color: teal ? brand.colors.ocean[700] : brand.colors.primary[700],
          fontFamily: brand.fonts.display,
        }}
      >
        {value}
      </p>
      <p className="text-sm" style={{ color: brand.colors.warm[700] }}>
        {label}
      </p>
    </div>
  );
}

function TinyTag({
  icon: Icon,
  label,
  teal = false,
}: {
  icon: typeof MapPin;
  label: string;
  teal?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs"
      style={{
        color: teal ? brand.colors.ocean[800] : brand.colors.primary[700],
        backgroundColor: teal ? brand.colors.ocean[50] : brand.colors.primary[50],
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function PinNumber({ number }: { number: string }) {
  return (
    <div className="relative flex flex-col items-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full border text-sm font-semibold"
        style={{
          color: brand.colors.warm[50],
          backgroundColor: brand.colors.primary[500],
          borderColor: brand.colors.primary[300],
          boxShadow: brand.shadows.md,
        }}
      >
        {number}
      </div>
      <div
        className="-mt-2 h-4 w-4 rotate-45"
        style={{ backgroundColor: brand.colors.primary[500] }}
      />
    </div>
  );
}

function MiniShot({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div
        className="mt-6 overflow-hidden rounded-[22px] border"
        style={{ borderColor: brand.colors.warm[200] }}
      >
        <div className="grid grid-cols-[1fr_88px]">
          <div className="p-4" style={{ backgroundColor: brand.colors.warm[50] }}>
            <div className="space-y-2">
              {["Tokyo", "Seoul", "Taipei"].map((city) => (
                <div
                  key={city}
                  className="flex items-center justify-between rounded-[16px] px-3 py-2"
                  style={{ backgroundColor: "#fff" }}
                >
                  <span
                    className="text-sm"
                    style={{ color: brand.colors.warm[800] }}
                  >
                    {city}
                  </span>
                  <PlaneTakeoff
                    className="h-4 w-4"
                    style={{ color: brand.colors.primary[600] }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div
            className="flex items-center justify-center"
            style={{ backgroundColor: brand.colors.primary[50] }}
          >
            <Route
              className="h-10 w-10"
              style={{ color: brand.colors.primary[500] }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div
        className="mt-6 overflow-hidden rounded-[24px] border p-4"
        style={{
          borderColor: brand.colors.ocean[100],
          background:
            "linear-gradient(180deg, rgba(240,253,250,0.86) 0%, rgba(255,255,255,0.9) 100%)",
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-[18px] p-4"
            style={{
              backgroundColor: "rgba(255,255,255,0.9)",
              transform: "rotate(-4deg)",
            }}
          >
            <div className="flex h-20 items-end">
              <Mountain
                className="h-8 w-8"
                style={{ color: brand.colors.ocean[600] }}
              />
            </div>
            <p
              className="mt-2 text-xs"
              style={{ color: brand.colors.warm[600] }}
            >
              Mountain train window
            </p>
          </div>
          <div
            className="rounded-[18px] p-4"
            style={{
              backgroundColor: "rgba(255,255,255,0.92)",
              transform: "rotate(5deg)",
            }}
          >
            <div className="flex h-20 items-end">
              <Sparkles
                className="h-8 w-8"
                style={{ color: brand.colors.sand[600] }}
              />
            </div>
            <p
              className="mt-2 text-xs"
              style={{ color: brand.colors.warm[600] }}
            >
              Handwritten caption
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mt-6 rounded-[22px] border p-4"
      style={{
        borderColor: brand.colors.warm[200],
        backgroundColor: "rgba(255,255,255,0.92)",
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase" style={{ color: brand.colors.warm[500] }}>
          export panel
        </p>
        <span
          className="rounded-full px-2.5 py-1 text-[11px]"
          style={{
            color: brand.colors.primary[700],
            backgroundColor: brand.colors.primary[50],
          }}
        >
          1080p
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {["Reels", "YouTube", "Square"].map((item, itemIndex) => (
          <div
            key={item}
            className="rounded-[16px] px-3 py-3 text-sm"
            style={{
              color: brand.colors.warm[700],
              backgroundColor:
                itemIndex === 0 ? brand.colors.primary[50] : brand.colors.warm[50],
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function UseCaseCard({
  title,
  meta,
  tone,
  height,
  span,
  index,
}: {
  title: string;
  meta: string;
  tone: "sunset" | "ocean" | "sand" | "warm";
  height: string;
  span: string;
  index: number;
}) {
  const tones = {
    sunset:
      "linear-gradient(180deg, rgba(255,237,213,0.82) 0%, rgba(255,247,237,0.9) 100%)",
    ocean:
      "linear-gradient(180deg, rgba(240,253,250,0.9) 0%, rgba(255,255,255,0.88) 100%)",
    sand:
      "linear-gradient(180deg, rgba(255,250,224,0.88) 0%, rgba(255,255,255,0.92) 100%)",
    warm:
      "linear-gradient(180deg, rgba(250,250,249,0.92) 0%, rgba(255,251,245,0.95) 100%)",
  };

  return (
    <article
      className={cn("relative overflow-hidden border p-5", height, span)}
      style={{
        borderColor: brand.colors.warm[200],
        background: tones[tone],
        borderRadius:
          index % 2 === 0 ? "28px 20px 30px 18px" : "22px 28px 20px 26px",
        boxShadow: brand.shadows.md,
      }}
    >
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-sm tracking-[0.18em] uppercase"
              style={{ color: brand.colors.warm[500] }}
            >
              Example trip
            </p>
            <h3
              className="mt-3 text-2xl leading-[1.02] font-semibold"
              style={{ color: brand.colors.warm[900], fontFamily: brand.fonts.display }}
            >
              {title}
            </h3>
            <p className="mt-2 text-sm leading-6" style={{ color: brand.colors.warm[600] }}>
              {meta}
            </p>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs"
            style={{
              color:
                tone === "ocean" ? brand.colors.ocean[700] : brand.colors.primary[700],
              backgroundColor:
                tone === "ocean" ? brand.colors.ocean[50] : brand.colors.primary[50],
            }}
          >
            preview
          </span>
        </div>

        <div className="relative mt-6 flex-1 overflow-hidden rounded-[24px] border">
          <div
            className="absolute inset-0"
            style={{
              borderColor: brand.colors.warm[200],
              background:
                "radial-gradient(circle at 22% 28%, rgba(249,115,22,0.14), transparent 20%), radial-gradient(circle at 74% 22%, rgba(20,184,166,0.12), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(250,250,249,0.94) 100%)",
            }}
          />
          <svg
            viewBox="0 0 640 320"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <path
              d="M72 258C130 232 152 112 230 118C308 124 320 266 406 238C484 212 498 112 578 72"
              fill="none"
              stroke={index % 2 === 0 ? brand.colors.primary[500] : brand.colors.ocean[500]}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray="16 14"
            />
            {[72, 230, 406, 578].map((cx, routeIndex) => (
              <g key={cx}>
                <circle
                  cx={cx}
                  cy={routeIndex === 0 ? 258 : routeIndex === 1 ? 118 : routeIndex === 2 ? 238 : 72}
                  r="16"
                  fill="#fff"
                />
                <circle
                  cx={cx}
                  cy={routeIndex === 0 ? 258 : routeIndex === 1 ? 118 : routeIndex === 2 ? 238 : 72}
                  r="8"
                  fill={
                    routeIndex % 2 === 0
                      ? brand.colors.primary[500]
                      : brand.colors.ocean[500]
                  }
                />
              </g>
            ))}
          </svg>
        </div>
      </div>
    </article>
  );
}
