"use client";

import Link from "next/link";
import MapStyleSelector from "./MapStyleSelector";

export default function TopToolbar() {
  return (
    <div className="flex h-12 items-center justify-between border-b bg-background px-4">
      <Link href="/" className="text-lg font-bold tracking-tight">
        TraceRecap
      </Link>
      <div className="flex items-center gap-2">
        <MapStyleSelector />
      </div>
    </div>
  );
}
