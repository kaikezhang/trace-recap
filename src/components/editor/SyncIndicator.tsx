"use client";

import { Cloud, CloudOff, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CloudSyncStatus } from "@/stores/uiStore";

const statusConfig: Record<
  Exclude<CloudSyncStatus, "idle">,
  { icon: typeof Cloud; color: string; tooltip: string; animate?: boolean }
> = {
  syncing: { icon: Cloud, color: "#f97316", tooltip: "Syncing...", animate: true },
  synced: { icon: Cloud, color: "#22c55e", tooltip: "Synced to cloud" },
  error: { icon: CloudOff, color: "#ef4444", tooltip: "Sync error" },
  offline: { icon: CloudOff, color: "#a8a29e", tooltip: "Offline" },
  conflict: { icon: AlertTriangle, color: "#eab308", tooltip: "Sync conflict — newer version on server" },
};

export default function SyncIndicator({ status }: { status: CloudSyncStatus }) {
  if (status === "idle") return null;

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={`inline-flex items-center justify-center h-8 w-8 ${config.animate ? "animate-pulse" : ""}`}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
          </span>
        }
      />
      <TooltipContent side="bottom" sideOffset={6}>
        {config.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
