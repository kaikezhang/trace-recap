"use client";

import { motion } from "framer-motion";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface OnboardingHintProps {
  message: string;
  onDismiss: () => void;
  className?: string;
  arrowClassName?: string;
  interactive?: boolean;
  dismissLabel?: string;
}

export default function OnboardingHint({
  message,
  onDismiss,
  className,
  arrowClassName,
  interactive = true,
  dismissLabel = "Click to dismiss",
}: OnboardingHintProps) {
  const content = (
    <>
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background: `radial-gradient(circle at top left, ${brand.colors.primary[100]}88 0%, transparent 46%)`,
        }}
        animate={{ opacity: [0.35, 0.6, 0.35] }}
        transition={{
          duration: 2.1,
          ease: "easeInOut",
          repeat: Number.POSITIVE_INFINITY,
        }}
      />
      <span className="relative flex items-start gap-3">
        <motion.span
          aria-hidden="true"
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{
            backgroundColor: brand.colors.primary[500],
            boxShadow: `0 0 0 5px ${brand.colors.primary[100]}`,
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.85, 1, 0.85] }}
          transition={{
            duration: 1.8,
            ease: "easeInOut",
            repeat: Number.POSITIVE_INFINITY,
          }}
        />
        <span className="min-w-0">
          <span
            className="mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{
              backgroundColor: brand.colors.primary[100],
              color: brand.colors.primary[700],
            }}
          >
            Hint
          </span>
          <span className="block text-xs font-medium leading-relaxed text-stone-800">
            {message}
          </span>
          <span className="mt-1.5 block text-[11px] text-stone-500">
            {dismissLabel}
          </span>
        </span>
      </span>
      <span
        className={cn(
          "absolute h-3.5 w-3.5 rotate-45 border",
          arrowClassName,
        )}
        style={{
          background: `linear-gradient(180deg, ${brand.colors.primary[50]} 0%, ${brand.colors.warm[50]} 100%)`,
          borderColor: brand.colors.primary[200],
          boxShadow: `2px 2px 10px rgba(120, 53, 15, 0.08)`,
        }}
        aria-hidden="true"
      />
    </>
  );

  if (interactive) {
    return (
      <motion.button
        type="button"
        onClick={onDismiss}
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: [1, 1.01, 1],
        }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        transition={{
          opacity: { duration: 0.22, ease: "easeOut" as const },
          y: { duration: 0.22, ease: "easeOut" as const },
          scale: {
            duration: 2.2,
            ease: "easeInOut" as const,
            repeat: Number.POSITIVE_INFINITY,
            repeatDelay: 1.1,
          },
        }}
        className={cn(
          "absolute z-[80] max-w-xs overflow-visible rounded-2xl border px-3.5 py-3 text-left backdrop-blur-sm",
          className,
        )}
        style={{
          background: `linear-gradient(180deg, ${brand.colors.primary[50]} 0%, rgba(255, 251, 245, 0.96) 100%)`,
          borderColor: `${brand.colors.primary[200]}`,
          boxShadow: brand.shadows.lg,
        }}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: [1, 1.01, 1],
      }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{
        opacity: { duration: 0.22, ease: "easeOut" as const },
        y: { duration: 0.22, ease: "easeOut" as const },
        scale: {
          duration: 2.2,
          ease: "easeInOut" as const,
          repeat: Number.POSITIVE_INFINITY,
          repeatDelay: 1.1,
        },
      }}
      className={cn(
        "absolute z-[80] max-w-xs overflow-visible rounded-2xl border px-3.5 py-3 text-left backdrop-blur-sm",
        className,
      )}
      style={{
        background: `linear-gradient(180deg, ${brand.colors.primary[50]} 0%, rgba(255, 251, 245, 0.96) 100%)`,
        borderColor: `${brand.colors.primary[200]}`,
        boxShadow: brand.shadows.lg,
      }}
    >
      {content}
    </motion.div>
  );
}
