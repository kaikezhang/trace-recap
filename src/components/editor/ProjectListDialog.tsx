"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Pencil,
  Check,
  X,
  FolderOpen,
  MapPin,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUIStore } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { useAuthStore } from "@/stores/authStore";
import type { ProjectMeta } from "@/types";

function formatDate(epoch: number): string {
  const d = new Date(epoch);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function ProjectRow({
  project,
  isCurrent,
  disabled,
  isAuthenticated,
  onSwitch,
  onRename,
  onDelete,
  onDuplicate,
}: {
  project: ProjectMeta;
  isCurrent: boolean;
  disabled: boolean;
  isAuthenticated: boolean;
  onSwitch: () => Promise<void>;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onDuplicate: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "switch" | "rename" | "delete" | "duplicate" | null
  >(null);
  const isBusy = disabled || pendingAction !== null;

  const handleSubmitRename = useCallback(async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === project.name) {
      setEditing(false);
      return;
    }

    setPendingAction("rename");
    try {
      await onRename(trimmed);
      setEditing(false);
    } catch (error) {
      console.error(`Failed to rename project ${project.id}.`, error);
    } finally {
      setPendingAction(null);
    }
  }, [editName, onRename, project.id, project.name]);

  const handleCancelRename = useCallback(() => {
    if (pendingAction === "rename") return;
    setEditName(project.name);
    setEditing(false);
  }, [pendingAction, project.name]);

  const runRowAction = useCallback(
    async (
      action: "switch" | "delete" | "duplicate",
      callback: () => Promise<void>,
    ) => {
      setPendingAction(action);
      try {
        await callback();
        if (action === "delete") {
          setConfirmDelete(false);
        }
      } catch (error) {
        console.error(`Failed to ${action} project ${project.id}.`, error);
      } finally {
        setPendingAction(null);
      }
    },
    [project.id],
  );

  // Delete confirmation bar
  if (confirmDelete) {
    return (
      <div
        className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/20"
        aria-busy={isBusy}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            Delete &ldquo;{project.name}&rdquo;?
          </p>
          <p className="mt-0.5 text-xs text-red-600/80 dark:text-red-300/60">
            This cannot be undone.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
            onClick={() => setConfirmDelete(false)}
            disabled={isBusy}
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            onClick={() => void runRowAction("delete", onDelete)}
            disabled={isBusy}
          >
            {pendingAction === "delete" ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-2 rounded-lg border p-3 transition-colors ${
        isCurrent
          ? "border-primary/30 bg-primary/5"
          : "border-transparent hover:border-border hover:bg-muted/50"
      } ${isBusy ? "opacity-70" : ""}`}
      aria-busy={isBusy}
    >
      <button
        className="flex flex-1 min-w-0 items-start gap-3 text-left"
        onClick={() => void runRowAction("switch", onSwitch)}
        disabled={isCurrent || isBusy}
      >
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
            isCurrent
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <FolderOpen className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-primary"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSubmitRename();
                  if (e.key === "Escape") handleCancelRename();
                }}
                disabled={isBusy}
                autoFocus
              />
              <button
                className="shrink-0 rounded-md p-1.5 text-green-600 hover:bg-green-50"
                onClick={() => void handleSubmitRename()}
                disabled={isBusy}
                aria-label="Save"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                onClick={handleCancelRename}
                disabled={isBusy}
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="truncate text-sm font-medium">{project.name}</p>
          )}
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            {project.previewLocations.length > 0 && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {project.previewLocations.join(" → ")}
              </span>
            )}
            {project.locationCount > 0 && (
              <span className="shrink-0">
                {project.locationCount} stop{project.locationCount !== 1 ? "s" : ""}
              </span>
            )}
            <span className="shrink-0">{formatDate(project.updatedAt)}</span>
          </div>
        </div>
      </button>

      {/* Actions dropdown — always visible, touch-friendly */}
      {!editing && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className="touch-target-mobile shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Project actions"
                disabled={isBusy}
              />
            }
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
            <DropdownMenuItem
              onClick={() => {
                setEditName(project.name);
                setEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" />
              Rename
            </DropdownMenuItem>
            {isAuthenticated && (
              <DropdownMenuItem
                onClick={() => void runRowAction("duplicate", onDuplicate)}
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default function ProjectListDialog() {
  const open = useUIStore((s) => s.projectListOpen);
  const setOpen = useUIStore((s) => s.setProjectListOpen);
  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const switchProject = useProjectStore((s) => s.switchProject);
  const createNewProject = useProjectStore((s) => s.createNewProject);
  const replaceCurrentProject = useProjectStore((s) => s.replaceCurrentProject);
  const deleteProjectById = useProjectStore((s) => s.deleteProjectById);
  const renameProjectById = useProjectStore((s) => s.renameProjectById);
  const duplicateProjectById = useProjectStore((s) => s.duplicateProjectById);
  const isSwitchingProject = useProjectStore((s) => s.isSwitchingProject);
  const user = useAuthStore((s) => s.user);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const handleNewProject = useCallback(async () => {
    try {
      await createNewProject();
      setOpen(false);
    } catch (error) {
      if (error instanceof Error && error.message === "CONFIRM_REPLACE") {
        setConfirmReplace(true);
        return;
      }
      console.error("Failed to create a new project.", error);
    }
  }, [createNewProject, setOpen]);

  const handleConfirmReplace = useCallback(async () => {
    try {
      await replaceCurrentProject();
      setConfirmReplace(false);
      setOpen(false);
    } catch (error) {
      console.error("Failed to replace project.", error);
    }
  }, [replaceCurrentProject, setOpen]);

  const handleSwitch = useCallback(
    async (projectId: string) => {
      try {
        await switchProject(projectId);
        setOpen(false);
      } catch (error) {
        console.error(`Failed to switch to project ${projectId}.`, error);
      }
    },
    [switchProject, setOpen],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Projects</DialogTitle>
          <DialogDescription>
            Switch between projects or create a new one.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] -mx-4 px-4">
          <div className="space-y-1">
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                isCurrent={project.id === currentProjectId}
                disabled={isSwitchingProject}
                isAuthenticated={!!user}
                onSwitch={() => handleSwitch(project.id)}
                onRename={(name) => renameProjectById(project.id, name)}
                onDelete={() => deleteProjectById(project.id)}
                onDuplicate={async () => {
                  await duplicateProjectById(project.id);
                }}
              />
            ))}
            {projects.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No projects yet. Create your first one!
              </p>
            )}
          </div>
        </ScrollArea>

        <div className="-mx-4 -mb-4 rounded-b-xl border-t bg-muted/50 p-3">
          {confirmReplace ? (
            <div className="space-y-2">
              <p className="text-center text-xs text-muted-foreground">
                This will replace your current project. Continue?
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setConfirmReplace(false)}
                  disabled={isSwitchingProject}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={() => void handleConfirmReplace()}
                  disabled={isSwitchingProject}
                >
                  {isSwitchingProject ? "Working..." : "Start Fresh"}
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Sign in to keep multiple projects
              </p>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => void handleNewProject()}
              disabled={isSwitchingProject}
            >
              <Plus className="h-4 w-4" />
              {isSwitchingProject ? "Working..." : "New Project"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
