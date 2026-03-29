"use client";

import { cn } from "@/lib/utils";

interface OnboardingHintProps {
  message: string;
  onDismiss: () => void;
  className?: string;
  arrowClassName?: string;
}

export default function OnboardingHint({
  message,
  onDismiss,
  className,
  arrowClassName,
}: OnboardingHintProps) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      className={cn(
        "absolute z-[80] max-w-xs rounded-lg border bg-background px-3 py-2 text-left shadow-lg",
        className,
      )}
    >
      <span className="block text-xs font-medium leading-relaxed">
        {message}
      </span>
      <span className="mt-1 block text-[11px] text-muted-foreground">
        Click to dismiss
      </span>
      <span
        className={cn(
          "absolute h-3 w-3 rotate-45 border bg-background",
          arrowClassName,
        )}
        aria-hidden="true"
      />
    </button>
  );
}
