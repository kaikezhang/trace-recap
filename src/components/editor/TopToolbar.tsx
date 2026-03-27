"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapStyleSelector from "./MapStyleSelector";
import { useUIStore } from "@/stores/uiStore";

export default function TopToolbar() {
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);

  return (
    <div className="flex h-12 items-center justify-between border-b bg-background px-4">
      <Link href="/" className="text-lg font-bold tracking-tight">
        TraceRecap
      </Link>
      <div className="flex items-center gap-2">
        <MapStyleSelector />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setExportDialogOpen(true)}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>
    </div>
  );
}
