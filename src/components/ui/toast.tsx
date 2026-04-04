"use client"

import { useEffect, type ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from "lucide-react"

import { brand } from "@/lib/brand"
import { cn } from "@/lib/utils"

type ToastVariant = "success" | "info" | "warning" | "error"

interface ToastData {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
}

interface ToastProps {
  title: string
  description?: string
  variant?: ToastVariant
  action?: ReactNode
  dismissAfterMs?: number
  onDismiss?: () => void
  className?: string
}

interface ToastViewportProps {
  toasts: ToastData[]
  onDismiss: (id: string) => void
  dismissAfterMs?: number
  className?: string
}

const toastStyles: Record<
  ToastVariant,
  {
    icon: typeof CheckCircle2
    accent: string
    background: string
    border: string
    progress: string
    label: string
  }
> = {
  success: {
    icon: CheckCircle2,
    accent: "#15803d",
    background: "linear-gradient(180deg, rgba(240, 253, 244, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%)",
    border: "rgba(34, 197, 94, 0.22)",
    progress: "linear-gradient(90deg, rgba(34, 197, 94, 0.95) 0%, rgba(34, 197, 94, 0.5) 100%)",
    label: "Success",
  },
  info: {
    icon: Info,
    accent: brand.colors.ocean[600],
    background: `linear-gradient(180deg, ${brand.colors.ocean[50]} 0%, rgba(255, 251, 245, 0.98) 100%)`,
    border: "rgba(20, 184, 166, 0.22)",
    progress: `linear-gradient(90deg, ${brand.colors.ocean[500]} 0%, rgba(20, 184, 166, 0.45) 100%)`,
    label: "Info",
  },
  warning: {
    icon: TriangleAlert,
    accent: brand.colors.sand[700],
    background: `linear-gradient(180deg, ${brand.colors.sand[50]} 0%, rgba(255, 251, 245, 0.98) 100%)`,
    border: "rgba(234, 179, 8, 0.28)",
    progress: `linear-gradient(90deg, ${brand.colors.sand[500]} 0%, rgba(234, 179, 8, 0.45) 100%)`,
    label: "Warning",
  },
  error: {
    icon: CircleAlert,
    accent: "#dc2626",
    background: "linear-gradient(180deg, rgba(254, 242, 242, 0.98) 0%, rgba(255, 251, 245, 0.98) 100%)",
    border: "rgba(239, 68, 68, 0.22)",
    progress: "linear-gradient(90deg, rgba(239, 68, 68, 0.95) 0%, rgba(239, 68, 68, 0.45) 100%)",
    label: "Error",
  },
}

function Toast({
  title,
  description,
  variant = "info",
  action,
  dismissAfterMs = 3000,
  onDismiss,
  className,
}: ToastProps) {
  const config = toastStyles[variant]
  const Icon = config.icon

  useEffect(() => {
    if (!onDismiss) return

    const timeoutId = window.setTimeout(() => {
      onDismiss()
    }, dismissAfterMs)

    return () => window.clearTimeout(timeoutId)
  }, [dismissAfterMs, onDismiss])

  return (
    <motion.div
      layout
      role={variant === "error" ? "alert" : "status"}
      initial={{ opacity: 0, x: 32, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, y: 8, scale: 0.98 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className={cn(
        "pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border p-4 shadow-lg backdrop-blur-md",
        className
      )}
      style={{
        background: config.background,
        borderColor: config.border,
        boxShadow: brand.shadows.lg,
      }}
    >
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: config.progress }}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: dismissAfterMs / 1000, ease: "linear" }}
      />

      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: `${config.accent}14`,
            color: config.accent,
          }}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: config.accent }}
          >
            {config.label}
          </p>
          <p className="text-sm font-medium text-stone-900">{title}</p>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              {description}
            </p>
          ) : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>

        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full p-1 text-stone-400 transition-colors hover:bg-black/5 hover:text-stone-700"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </motion.div>
  )
}

function ToastViewport({
  toasts,
  onDismiss,
  dismissAfterMs = 3000,
  className,
}: ToastViewportProps) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed bottom-4 right-4 z-[120] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3",
        className
      )}
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            dismissAfterMs={dismissAfterMs}
            onDismiss={() => onDismiss(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

export { Toast, ToastViewport }
export type { ToastData, ToastProps, ToastVariant, ToastViewportProps }
