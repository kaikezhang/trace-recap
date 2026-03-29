"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  className?: string
  value?: number[]
  defaultValue?: number[]
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  onValueChange?: (value: number[]) => void
}

function Slider({
  className,
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  onValueChange,
}: SliderProps) {
  const currentValue = value?.[0] ?? defaultValue?.[0] ?? min
  const percentage = ((currentValue - min) / (max - min)) * 100

  return (
    <div
      data-slot="slider"
      className={cn("relative flex w-full touch-none items-center select-none", className)}
    >
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          data-slot="slider-range"
          className="absolute h-full bg-primary rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        disabled={disabled}
        onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        aria-label="Slider"
      />
      <div
        data-slot="slider-thumb"
        className="absolute block size-4 shrink-0 rounded-full border border-primary ring-ring/50 bg-white shadow-sm transition-[color,box-shadow] pointer-events-none"
        style={{ left: `calc(${percentage}% - 8px)` }}
      />
    </div>
  )
}

export { Slider }
