"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { brand } from "@/lib/brand";

const faqs = [
  {
    question: "Is TraceRecap free to use?",
    answer:
      "You can start building recaps in the browser without paying first. Paid limits can come later, but the product pitch is still fast creation before pricing friction.",
  },
  {
    question: "Do I need an account before trying it?",
    answer:
      "No. The landing flow points people straight into the editor. Account creation only matters if you want to save projects or manage exports later.",
  },
  {
    question: "Which browsers does it support?",
    answer:
      "The product is built for current desktop and mobile browsers with modern video and canvas support. Chrome, Safari, Edge, and Firefox are the intended baseline.",
  },
  {
    question: "What export quality can I expect?",
    answer:
      "The redesign positions exports as social-ready and presentation-ready: vertical reels, square posts, and large landscape renders for YouTube or trip films.",
  },
  {
    question: "What happens to my travel photos and route data?",
    answer:
      "The privacy story stays explicit: your trip data remains tied to your project, and the page frames TraceRecap as a tool for making memories visible, not for reselling them.",
  },
  {
    question: "Can I build recaps for road trips, walking tours, and food routes too?",
    answer:
      "Yes. The gallery and examples deliberately cover backpacking, road trips, city walking routes, and food tours so the product does not feel locked to flights only.",
  },
] as const;

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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
            Keep the answers plain. The landing page should feel warm, but the
            product promises still need to sound credible.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={item.question}
                className="overflow-hidden border"
                style={{
                  borderColor: isOpen
                    ? brand.colors.primary[200]
                    : brand.colors.warm[200],
                  backgroundColor: "rgba(255,255,255,0.78)",
                  borderRadius: index % 2 === 0 ? "28px 18px 24px 20px" : "22px 28px 18px 24px",
                  boxShadow: isOpen ? brand.shadows.lg : brand.shadows.sm,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-6"
                  aria-expanded={isOpen}
                >
                  <span
                    className="text-base font-medium sm:text-lg"
                    style={{ color: brand.colors.warm[900] }}
                  >
                    {item.question}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.24 }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center"
                    style={{ color: brand.colors.primary[600] }}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                    >
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
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
