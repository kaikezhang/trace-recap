import Link from "next/link";
import {
  Download,
  MapPin,
  Palette,
  Plane,
  type LucideIcon,
} from "lucide-react";

const steps: Array<{
  icon: LucideIcon;
  title: string;
  description: string;
  iconClassName: string;
  iconWrapperClassName: string;
}> = [
  {
    icon: MapPin,
    title: "Add Cities",
    description:
      "Search and add your travel destinations. Drag to reorder, set transport modes between each stop.",
    iconClassName: "text-indigo-500",
    iconWrapperClassName: "bg-indigo-50",
  },
  {
    icon: Palette,
    title: "Customize Route",
    description:
      "Choose map styles, add photos, adjust timing. Make every detail perfect.",
    iconClassName: "text-fuchsia-500",
    iconWrapperClassName: "bg-fuchsia-50",
  },
  {
    icon: Download,
    title: "Export Video",
    description:
      "One-click export to MP4. Share on social media, embed in blogs, or keep as a memory.",
    iconClassName: "text-amber-500",
    iconWrapperClassName: "bg-amber-50",
  },
];

export default function Home() {
  return (
    <main className="gradient-mesh min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 pb-12 pt-6 sm:px-10 lg:px-12">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
            <Plane className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-gray-900">
            TraceRecap
          </span>
        </header>

        <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center pt-20 text-center sm:pt-24 lg:pt-28">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              <span className="block">Turn your travel routes into</span>
              <span className="block bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                cinematic animated videos
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-8 text-gray-500">
              Create beautiful route animations with photos, custom transport
              modes, and one-click video export. No video editing skills
              needed.
            </p>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/editor?demo=true"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 hover:bg-indigo-600"
            >
              Try Demo
            </Link>
            <Link
              href="/editor"
              className="inline-flex items-center justify-center rounded-xl border-2 border-gray-200 bg-white/70 px-8 py-3 text-sm font-semibold text-gray-700 transition-colors hover:border-indigo-300"
            >
              New Journey
            </Link>
          </div>

          <div className="relative mt-16 w-full max-w-3xl">
            <div className="absolute -right-6 -top-6 h-16 w-16 rounded-[1.75rem] bg-gradient-to-br from-amber-300 to-orange-400 opacity-90 shadow-xl shadow-orange-200/70 rotate-12" />
            <div className="absolute -bottom-5 -left-5 h-10 w-10 rounded-full bg-indigo-500/85 blur-[1px]" />

            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 shadow-2xl shadow-slate-900/10">
              <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-white/70 bg-white/80 px-5 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600" />
                  <div className="space-y-1 text-left">
                    <div className="h-2 w-24 rounded-full bg-gray-900/80" />
                    <div className="h-2 w-16 rounded-full bg-gray-300" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <div className="h-2 w-2 rounded-full bg-amber-300" />
                  <div className="h-2 w-2 rounded-full bg-rose-300" />
                </div>
              </div>

              <div className="absolute inset-x-6 bottom-16 top-[4.5rem] rounded-[1.5rem] border border-white/60 bg-white/50 shadow-inner shadow-white/50 backdrop-blur-sm">
                <div className="absolute inset-0 opacity-60">
                  <div className="absolute left-[10%] top-[18%] h-24 w-24 rounded-full border border-indigo-100 bg-white/40" />
                  <div className="absolute right-[12%] top-[20%] h-32 w-32 rounded-full border border-purple-100 bg-white/30" />
                  <div className="absolute bottom-[18%] left-[24%] h-20 w-20 rounded-full border border-pink-100 bg-white/30" />
                  <div className="absolute inset-x-[12%] top-[28%] h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent" />
                  <div className="absolute inset-x-[18%] top-[56%] h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent" />
                  <div className="absolute left-[30%] top-[12%] h-[72%] w-px bg-gradient-to-b from-transparent via-indigo-100 to-transparent" />
                  <div className="absolute left-[62%] top-[16%] h-[66%] w-px bg-gradient-to-b from-transparent via-pink-100 to-transparent" />
                </div>

                <svg
                  viewBox="0 0 1000 560"
                  className="absolute inset-0 h-full w-full"
                  aria-hidden="true"
                >
                  <path
                    d="M118 405C185 360 257 258 340 274C421 289 470 416 564 398C663 379 700 174 820 159"
                    fill="none"
                    stroke="url(#routeGradient)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="18 18"
                  />
                  <defs>
                    <linearGradient
                      id="routeGradient"
                      x1="118"
                      y1="405"
                      x2="820"
                      y2="159"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#6366f1" />
                      <stop offset="0.5" stopColor="#8b5cf6" />
                      <stop offset="1" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                  <circle cx="118" cy="405" r="16" fill="#ffffff" />
                  <circle cx="118" cy="405" r="9" fill="#6366f1" />
                  <circle cx="340" cy="274" r="16" fill="#ffffff" />
                  <circle cx="340" cy="274" r="9" fill="#8b5cf6" />
                  <circle cx="564" cy="398" r="16" fill="#ffffff" />
                  <circle cx="564" cy="398" r="9" fill="#ec4899" />
                  <circle cx="820" cy="159" r="16" fill="#ffffff" />
                  <circle cx="820" cy="159" r="9" fill="#f97316" />
                </svg>

                <div className="absolute left-[9%] top-[63%] rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                  Lisbon
                </div>
                <div className="absolute left-[30%] top-[22%] rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                  Rome
                </div>
                <div className="absolute left-[53%] top-[61%] rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                  Athens
                </div>
                <div className="absolute right-[9%] top-[12%] rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                  Istanbul
                </div>
              </div>

              <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/70 bg-white/85 px-5 py-4 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                    <Plane className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="h-2.5 rounded-full bg-gray-200">
                      <div className="h-2.5 w-2/3 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs font-medium text-gray-400">
                      <span>00:18</span>
                      <span>00:42</span>
                    </div>
                  </div>
                  <div className="hidden rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 sm:block">
                    4 stops
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-24 w-full max-w-4xl">
          <h2 className="mb-12 text-center text-2xl font-bold text-gray-900">
            How it works
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;

              return (
                <article
                  key={step.title}
                  className="rounded-2xl border border-gray-100 bg-white/80 p-6 shadow-sm backdrop-blur-sm"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${step.iconWrapperClassName}`}
                  >
                    <Icon className={`h-6 w-6 ${step.iconClassName}`} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-gray-500">
                    {step.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <footer className="mt-24 pb-12 text-center">
          <p className="text-sm text-gray-400">Built with ❤️ for travelers</p>
        </footer>
      </div>
    </main>
  );
}
