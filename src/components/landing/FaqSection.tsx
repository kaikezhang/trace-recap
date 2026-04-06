import { ChevronDown } from "lucide-react";
import { brand } from "@/lib/brand";

const faqs = [
  {
    question: "Is TraceRecap free to use?",
    answer:
      "Yes — you can build recaps in the browser for free, no credit card required. We may introduce optional paid tiers in the future, but the core creation experience will always be accessible.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No sign-up needed to start. Without an account, your current project stays local in your browser. Sign in to keep multiple projects and sync across devices.",
  },
  {
    question: "Which browsers does it support?",
    answer:
      "TraceRecap works on modern desktop and mobile browsers including Chrome, Safari, Edge, and Firefox. Export uses browser-native video encoding for the best compatibility.",
  },
  {
    question: "What about my data?",
    answer:
      "Your route and photos are stored in your browser by default. When you sign in, data syncs to the cloud so you can access it across devices. We never share your data with third parties.",
  },
  {
    question: "What export formats are available?",
    answer:
      "Exports are sized for the platforms you share on — vertical for Instagram Reels and TikTok, landscape for YouTube, and square for posts. Download as MP4, ready to upload.",
  },
] as const;

export function FaqSection() {
  return (
    <section id="faq" className="mt-24 sm:mt-28 lg:mt-36">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] lg:gap-12">
        <div className="max-w-md">
          <p
            className="text-sm tracking-[0.24em] uppercase"
            style={{ color: brand.colors.primary[700] }}
          >
            FAQ
          </p>
          <h2
            className="mt-4 text-3xl leading-[0.96] font-semibold sm:text-4xl lg:text-5xl"
            style={{ color: brand.colors.warm[900], fontFamily: brand.fonts.display }}
          >
            Questions before your first recap.
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((item, index) => {
            return (
              <details
                key={item.question}
                className="group overflow-hidden border"
                name="faq"
                open={index === 0}
                style={{
                  borderColor: brand.colors.warm[200],
                  backgroundColor: "rgba(255,255,255,0.78)",
                  borderRadius: index % 2 === 0 ? "28px 18px 24px 20px" : "22px 28px 18px 24px",
                  boxShadow: brand.shadows.sm,
                }}
              >
                <summary
                  className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-left sm:px-6"
                >
                  <span
                    className="text-base font-medium sm:text-lg"
                    style={{ color: brand.colors.warm[900] }}
                  >
                    {item.question}
                  </span>
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center transition-transform duration-200 group-open:rotate-180"
                    style={{ color: brand.colors.primary[600] }}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </span>
                </summary>

                <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                  <div
                    className="mb-4 h-px"
                    style={{
                      background: `linear-gradient(90deg, ${brand.colors.primary[200]} 0%, ${brand.colors.ocean[200]} 100%)`,
                    }}
                  />
                  <p
                    className="max-w-2xl text-sm leading-7 sm:text-base"
                    style={{ color: brand.colors.warm[600] }}
                  >
                    {item.answer}
                  </p>
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
