import { ChevronDown } from "lucide-react";
import { brand } from "@/lib/brand";

const faqs = [
  {
    question: "Is TraceRecap free to use?",
    answer:
      "Yes — you can start building recaps in the browser for free, no credit card required. We may introduce optional paid tiers in the future, but the core creation experience will always be accessible.",
  },
  {
    question: "Do I need an account before trying it?",
    answer:
      "No. You can jump straight into the editor and start building a recap right away — no sign-up needed. An account is only required if you want to save projects or manage exports later.",
  },
  {
    question: "Which browsers does it support?",
    answer:
      "TraceRecap works on all modern desktop and mobile browsers. Chrome, Safari, Edge, and Firefox are fully supported.",
  },
  {
    question: "What export quality can I expect?",
    answer:
      "Exports are sized for the platforms you actually share on — vertical reels for Instagram and TikTok, square posts for WeChat, and widescreen renders for YouTube or trip films.",
  },
  {
    question: "What happens to my travel photos and route data?",
    answer:
      "Your photos and route data stay in your browser and are never uploaded to our servers. TraceRecap is a tool for making your memories visible — we don't collect, share, or sell your travel data.",
  },
  {
    question: "Can I build recaps for road trips, walking tours, and food routes too?",
    answer:
      "Absolutely. TraceRecap supports any kind of journey — backpacking trips, road trips, city walking tours, food routes, and more. Choose from trains, cars, ferries, and flights to match how you actually traveled.",
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
            The practical questions people ask before they trust a new travel tool.
          </h2>
          <p
            className="mt-5 text-base leading-7 sm:text-lg"
            style={{ color: brand.colors.warm[600] }}
          >
            Everything you need to know before building your first recap.
          </p>
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
