"use client"

import type { CSSProperties, HTMLAttributes } from "react"
import { motion } from "framer-motion"

import { brand } from "@/lib/brand"
import { cn } from "@/lib/utils"

type SkeletonProps = HTMLAttributes<HTMLDivElement>

function Skeleton({ className, style, ...props }: SkeletonProps) {
  const skeletonStyle: CSSProperties = {
    backgroundColor: brand.colors.warm[100],
    borderColor: brand.colors.warm[200],
    boxShadow: `inset 0 1px 0 ${brand.colors.warm[50]}`,
    ...style,
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative isolate overflow-hidden rounded-xl border",
        className
      )}
      style={skeletonStyle}
      {...props}
    >
      <motion.span
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${brand.colors.primary[100]} 45%, ${brand.colors.sand[100]} 55%, transparent 100%)`,
          opacity: 0.85,
          filter: "blur(10px)",
        }}
        animate={{ x: ["-30%", "260%"] }}
        transition={{
          duration: 1.45,
          ease: "easeInOut",
          repeat: Number.POSITIVE_INFINITY,
        }}
      />
      <motion.span
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${brand.colors.warm[50]}55 0%, transparent 28%, transparent 72%, ${brand.colors.warm[200]}33 100%)`,
        }}
        animate={{ opacity: [0.55, 0.75, 0.55] }}
        transition={{
          duration: 2.2,
          ease: "easeInOut",
          repeat: Number.POSITIVE_INFINITY,
        }}
      />
    </div>
  )
}

export { Skeleton }
