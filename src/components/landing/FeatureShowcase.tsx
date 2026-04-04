"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  CircleCheck,
  Clapperboard,
  ImagePlus,
  MapPin,
  MonitorPlay,
  PlaneTakeoff,
  Route,
  Sparkles,
  TrainFront,
  Upload,
  Waypoints,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "Route Building",
    eyebrow: "Sketch the journey like a director blocks a scene",
    description:
      "Drag cities into place, swap trains for ferries, and let TraceRecap turn the messy middle of a trip into one clear arc.",
    points: ["Smart route smoothing", "Transport-aware pacing", "Scene timing that feels human"],
    accent: "Route-first storytelling",
    kind: "route",
  },
  {
    title: "Photo Stories",
    eyebrow: "Fold the camera roll back into the map",
    description:
      "Drop moments onto stops, layer captions, and let each memory surface exactly when the route reaches it.",
    points: ["Caption cards with personality", "Polaroid and journal layouts", "Stops that sync with your best frames"],
    accent: "Memory-led editing",
    kind: "photos",
  },
  {
    title: "One-Click Export",
    eyebrow: "Ship a reel, short, or trip film without opening another editor",
    description:
      "Pick a format, preview the timing, and export polished travel videos sized for the platforms people actually share on.",
    points: ["Vertical and landscape presets", "Browser-native rendering", "Ready for TikTok, Reels, and YouTube"],
    accent: "Export without friction",
    kind: "export",
  },
] as const;

const reveal = {
  rest: { opacity: 1, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.75,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export function FeatureShowcase() {
  return (
    <section id="features" className="mt-24 sm:mt-28 lg:mt-36">
      <motion.div
        variants={reveal}
        initial="rest"
        whileInView="visible"
        viewport={{ once: true, amount: 0.35 }}
        className="max-w-3xl"
      >
        <p
          className="text-sm tracking-[0.24em] uppercase"
          style={{ color: brand.colors.primary[700] }}
        >
          Feature Showcase
        </p>
        <h2
          className="mt-4 max-w-2xl text-4xl leading-[0.95] font-semibold sm:text-5xl"
          style={{ color: brand.colors.warm[900], fontFamily: brand.fonts.display }}
        >
          Every section of the product should feel like part of the trip, not
          a detour into software.
        </h2>
        <p
          className="mt-5 max-w-2xl text-base leading-7 sm:text-lg"
          style={{ color: brand.colors.warm[600] }}
        >
          The editor stays tactile and cinematic: routes stay readable, photos
          stay emotional, and exports stay fast.
        </p>
      </motion.div>

      <div className="mt-14 space-y-20 lg:mt-20 lg:space-y-28">
        {features.map((feature, index) => {
          const reverse = index % 2 === 1;

          return (
            <motion.article
              key={feature.title}
              variants={reveal}
              initial="rest"
              whileInView="visible"
              viewport={{ once: true, amount: 0.25 }}
              className={cn(
                "grid items-center gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:gap-14",
                reverse && "lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]",
              )}
            >
              <div
                className={cn(
                  "max-w-xl",
                  reverse ? "lg:order-2 lg:pl-4" : "lg:pr-4",
                )}
              >
                <div
                  className="inline-flex items-center gap-3 rounded-full px-3 py-2 text-xs tracking-[0.18em] uppercase"
                  style={{
                    color: brand.colors.primary[700],
                    backgroundColor: brand.colors.primary[50],
                    border: `1px solid ${brand.colors.primary[100]}`,
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {feature.accent}
                </div>
                <h3
                  className="mt-5 text-3xl leading-[1] font-semibold sm:text-4xl"
                  style={{
                    color: brand.colors.warm[900],
                    fontFamily: brand.fonts.display,
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  className="mt-4 max-w-lg text-lg leading-8"
                  style={{ color: brand.colors.warm[800] }}
                >
                  {feature.eyebrow}
                </p>
                <p
                  className="mt-4 max-w-lg text-base leading-7"
                  style={{ color: brand.colors.warm[600] }}
                >
                  {feature.description}
                </p>
                <div className="mt-7 space-y-3">
                  {feature.points.map((point) => (
                    <div key={point} className="flex items-center gap-3">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: brand.colors.ocean[50],
                          color: brand.colors.ocean[700],
                        }}
                      >
                        <CircleCheck className="h-4 w-4" />
                      </span>
                      <span
                        className="text-sm sm:text-base"
                        style={{ color: brand.colors.warm[700] }}
                      >
                        {point}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <motion.div
                className={cn(
                  "relative",
                  reverse ? "lg:order-1 lg:-translate-x-2" : "lg:translate-x-2",
                )}
                initial={{ opacity: 1, scale: 0.98, rotate: reverse ? -2 : 2 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <FeatureVisual kind={feature.kind} />
              </motion.div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

function FeatureVisual({
  kind,
}: {
  kind: (typeof features)[number]["kind"];
}) {
  if (kind === "route") {
    return (
      <div
        className="relative overflow-hidden border p-5 sm:p-6"
        style={{
          borderColor: brand.colors.warm[200],
          background:
            "linear-gradient(150deg, rgba(255,251,245,0.98) 0%, rgba(255,237,213,0.7) 100%)",
          borderRadius: "30px 22px 34px 24px",
          boxShadow: brand.shadows.xl,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-[14px]"
              style={{
                backgroundColor: brand.colors.primary[500],
                color: brand.colors.warm[50],
              }}
            >
              <Route className="h-5 w-5" />
            </span>
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: brand.colors.warm[900] }}
              >
                Route Builder
              </p>
              <p
                className="text-xs"
                style={{ color: brand.colors.warm[500] }}
              >
                Lisbon to Tokyo, stitched scene by scene
              </p>
            </div>
          </div>
          <div
            className="rounded-full px-3 py-1 text-xs"
            style={{
              color: brand.colors.ocean[800],
              backgroundColor: brand.colors.ocean[50],
            }}
          >
            08 stops
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
          <div
            className="rounded-[22px] border p-4"
            style={{
              borderColor: brand.colors.warm[200],
              backgroundColor: "rgba(255,255,255,0.78)",
            }}
          >
            <div className="space-y-3">
              {[
                { city: "Seoul", icon: PlaneTakeoff },
                { city: "Kyoto", icon: TrainFront },
                { city: "Naoshima", icon: Waypoints },
              ].map(({ city, icon: Icon }) => (
                <div
                  key={city}
                  className="flex items-center justify-between rounded-[18px] px-3 py-2"
                  style={{ backgroundColor: brand.colors.warm[50] }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: brand.colors.primary[100],
                        color: brand.colors.primary[700],
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: brand.colors.warm[800] }}
                    >
                      {city}
                    </span>
                  </div>
                  <ArrowRight
                    className="h-4 w-4"
                    style={{ color: brand.colors.warm[400] }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div
            className="relative min-h-[240px] overflow-hidden rounded-[28px] border sm:min-h-[320px]"
            style={{
              borderColor: brand.colors.warm[200],
              background:
                "radial-gradient(circle at 20% 25%, rgba(20,184,166,0.18), transparent 20%), radial-gradient(circle at 78% 18%, rgba(249,115,22,0.18), transparent 20%), rgba(255,255,255,0.78)",
            }}
          >
            <div
              className="absolute inset-4 rounded-[22px]"
              style={{
                border: `1px dashed ${brand.colors.warm[200]}`,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(255,247,237,0.3) 100%)",
              }}
            />
            <svg
              viewBox="0 0 700 420"
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="feature-route-line" x1="90" y1="310" x2="590" y2="90">
                  <stop stopColor={brand.colors.primary[500]} />
                  <stop offset="0.56" stopColor={brand.colors.sand[500]} />
                  <stop offset="1" stopColor={brand.colors.ocean[500]} />
                </linearGradient>
              </defs>
              <path
                d="M92 308C154 274 208 154 280 168C344 181 387 318 452 310C526 302 538 145 608 98"
                fill="none"
                stroke="url(#feature-route-line)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="18 18"
              />
              {[92, 280, 452, 608].map((cx, index) => (
                <g key={cx}>
                  <circle
                    cx={cx}
                    cy={index === 0 ? 308 : index === 1 ? 168 : index === 2 ? 310 : 98}
                    r="18"
                    fill="#fff"
                  />
                  <circle
                    cx={cx}
                    cy={index === 0 ? 308 : index === 1 ? 168 : index === 2 ? 310 : 98}
                    r="9"
                    fill={
                      index === 0
                        ? brand.colors.primary[500]
                        : index === 1
                          ? brand.colors.sand[500]
                          : index === 2
                            ? brand.colors.primary[300]
                            : brand.colors.ocean[500]
                    }
                  />
                </g>
              ))}
            </svg>

            {[
              { label: "Seoul", left: "10%", top: "64%" },
              { label: "Kyoto", left: "34%", top: "26%" },
              { label: "Osaka", left: "58%", top: "66%" },
              { label: "Naoshima", right: "8%", top: "14%" },
            ].map((city) => (
              <span
                key={city.label}
                className="absolute rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  ...city,
                  color: brand.colors.warm[700],
                  backgroundColor: "rgba(255,255,255,0.88)",
                  boxShadow: brand.shadows.md,
                }}
              >
                {city.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (kind === "photos") {
    return (
      <div
        className="relative overflow-hidden border px-5 py-6 sm:px-6"
        style={{
          borderColor: brand.colors.warm[200],
          background:
            "linear-gradient(135deg, rgba(255,251,245,0.98) 0%, rgba(240,253,250,0.82) 100%)",
          borderRadius: "22px 34px 24px 32px",
          boxShadow: brand.shadows.xl,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: brand.colors.warm[900] }}
            >
              Story Frames
            </p>
            <p
              className="text-xs"
              style={{ color: brand.colors.warm[500] }}
            >
              Memories appear on cue, not in a dump at the end
            </p>
          </div>
          <div className="flex gap-2">
            <Pill icon={ImagePlus} label="12 photos" />
            <Pill icon={Camera} label="3 captions" teal />
          </div>
        </div>

        <div className="relative mt-6 min-h-[280px] sm:min-h-[340px]">
          <div
            className="absolute left-1 top-8 h-48 w-[60%] rounded-[28px] border p-3 sm:left-2 sm:h-56 sm:w-[66%] sm:p-4"
            style={{
              borderColor: brand.colors.warm[200],
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,247,237,0.6) 100%)",
              transform: "rotate(-6deg)",
            }}
          >
            <div
              className="flex h-full flex-col justify-between rounded-[22px] p-5"
              style={{
                background:
                  "radial-gradient(circle at 65% 35%, rgba(249,115,22,0.16), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(250,250,249,0.88) 100%)",
              }}
            >
              <div className="flex items-center justify-between text-xs">
                <span
                  className="rounded-full px-3 py-1"
                  style={{
                    color: brand.colors.primary[700],
                    backgroundColor: brand.colors.primary[50],
                  }}
                >
                  Night market
                </span>
                <Camera
                  className="h-4 w-4"
                  style={{ color: brand.colors.warm[400] }}
                />
              </div>
              <div className="space-y-2">
                <div
                  className="h-4 w-2/3 rounded-full"
                  style={{ backgroundColor: brand.colors.warm[200] }}
                />
                <div
                  className="h-3 w-1/2 rounded-full"
                  style={{ backgroundColor: brand.colors.warm[100] }}
                />
              </div>
            </div>
          </div>

          <div
            className="absolute right-1 top-2 h-52 w-[50%] rounded-[32px] border p-3 sm:right-2 sm:h-64 sm:w-[54%] sm:p-4"
            style={{
              borderColor: brand.colors.ocean[100],
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(240,253,250,0.8) 100%)",
              transform: "rotate(5deg)",
            }}
          >
            <div
              className="relative h-full overflow-hidden rounded-[24px]"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, rgba(20,184,166,0.18), transparent 22%), radial-gradient(circle at 70% 72%, rgba(234,179,8,0.2), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(250,250,249,0.88) 100%)",
              }}
            >
              <div
                className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs"
                style={{
                  color: brand.colors.ocean[800],
                  backgroundColor: "rgba(255,255,255,0.9)",
                }}
              >
                Kyoto • Day 4
              </div>
              <div
                className="absolute bottom-4 left-4 max-w-[220px] rounded-[18px] px-4 py-3 text-sm leading-6"
                style={{
                  color: brand.colors.warm[700],
                  backgroundColor: "rgba(255,255,255,0.88)",
                  boxShadow: brand.shadows.md,
                }}
              >
                “Found the tiny ramen bar we were still talking about three
                cities later.”
              </div>
            </div>
          </div>

          <div
            className="absolute bottom-1 left-[20%] rounded-[20px] border px-4 py-3"
            style={{
              borderColor: brand.colors.sand[200],
              backgroundColor: "rgba(255,250,224,0.92)",
              boxShadow: brand.shadows.lg,
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full"
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
                  Journal overlay
                </p>
                <p
                  className="text-xs"
                  style={{ color: brand.colors.warm[500] }}
                >
                  Fade in at 00:18
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden border p-5 sm:p-6"
      style={{
        borderColor: brand.colors.warm[200],
        background:
          "linear-gradient(155deg, rgba(255,251,245,0.98) 0%, rgba(255,237,213,0.72) 52%, rgba(240,253,250,0.7) 100%)",
        borderRadius: "34px 24px 28px 20px",
        boxShadow: brand.shadows.xl,
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p
            className="text-sm font-medium"
            style={{ color: brand.colors.warm[900] }}
          >
            Export Studio
          </p>
          <p className="text-xs" style={{ color: brand.colors.warm[500] }}>
            One click, then it is ready to post
          </p>
        </div>
        <Pill icon={Upload} label="4K ready" teal />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,0.58fr)]">
        <div
          className="relative overflow-hidden rounded-[28px] border p-4"
          style={{
            borderColor: brand.colors.warm[200],
            backgroundColor: "rgba(255,255,255,0.84)",
          }}
        >
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#f97316]/12 to-transparent" />
          <div
            className="mx-auto min-h-[320px] max-w-[220px] rounded-[32px] border p-3"
            style={{
              borderColor: brand.colors.warm[200],
              backgroundColor: brand.colors.warm[900],
              boxShadow: brand.shadows.lg,
            }}
          >
            <div
              className="relative h-full rounded-[24px] p-4"
              style={{
                background:
                  "linear-gradient(180deg, rgba(28,25,23,0.94) 0%, rgba(41,37,36,0.94) 100%)",
              }}
            >
              <div className="flex items-center justify-between text-xs text-white/80">
                <span>Vertical preset</span>
                <Clapperboard className="h-4 w-4" />
              </div>
              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-2 text-white">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: brand.colors.primary[500] }}
                  />
                  <span className="text-sm">Europe backpacking reel</span>
                </div>
                <div
                  className="h-40 rounded-[22px]"
                  style={{
                    background:
                      "radial-gradient(circle at 32% 35%, rgba(249,115,22,0.35), transparent 26%), radial-gradient(circle at 68% 72%, rgba(20,184,166,0.28), transparent 30%), linear-gradient(180deg, rgba(68,64,60,0.25) 0%, rgba(28,25,23,0.18) 100%)",
                  }}
                />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Rendering</span>
                    <span>84%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <motion.div
                      className="h-2 rounded-full"
                      style={{
                        background: brand.gradients.route,
                      }}
                      initial={{ width: "24%" }}
                      whileInView={{ width: "84%" }}
                      viewport={{ once: true, amount: 0.5 }}
                      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div
            className="rounded-[24px] border p-4"
            style={{
              borderColor: brand.colors.warm[200],
              backgroundColor: "rgba(255,255,255,0.78)",
            }}
          >
            <p
              className="text-xs tracking-[0.18em] uppercase"
              style={{ color: brand.colors.warm[500] }}
            >
              Output
            </p>
            <div className="mt-3 space-y-3">
              {[
                "Instagram Reels 1080×1920",
                "YouTube 4K landscape",
                "Square recap for WeChat",
              ].map((option, index) => (
                <div
                  key={option}
                  className="rounded-[18px] px-3 py-3 text-sm"
                  style={{
                    color: brand.colors.warm[800],
                    backgroundColor:
                      index === 0
                        ? brand.colors.primary[50]
                        : brand.colors.warm[50],
                  }}
                >
                  {option}
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-[20px] border px-4 py-5"
            style={{
              borderColor: brand.colors.ocean[100],
              background:
                "linear-gradient(180deg, rgba(240,253,250,0.9) 0%, rgba(255,255,255,0.88) 100%)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-[16px]"
                style={{
                  backgroundColor: brand.colors.ocean[500],
                  color: brand.colors.warm[50],
                }}
              >
                <MonitorPlay className="h-5 w-5" />
              </span>
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: brand.colors.warm[900] }}
                >
                  Share-ready in the browser
                </p>
                <p
                  className="text-xs"
                  style={{ color: brand.colors.warm[500] }}
                >
                  No desktop editor detour
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({
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
