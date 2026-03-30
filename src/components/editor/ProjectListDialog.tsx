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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUIStore } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
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
  onSwitch,
  onRename,
  onDelete,
  onDuplicate,
}: {
  project: ProjectMeta;
  isCurrent: boolean;
  disabled: boolean;
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

  return (
    <div
      className={`group flex items-center gap-3 rounded-lg border p-3 transition-colors ${
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
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                className="h-6 w-full rounded border bg-background px-1.5 text-sm outline-none focus:border-primary"
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
                className="shrink-0 rounded p-0.5 text-green-600 hover:bg-green-50"
                onClick={() => void handleSubmitRename()}
                disabled={isBusy}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
                onClick={handleCancelRename}
                disabled={isBusy}
              >
                <X className="h-3.5 w-3.5" />
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

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {!editing && (
          <button
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setEditName(project.name);
              setEditing(true);
            }}
            disabled={isBusy}
            title="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            void runRowAction("duplicate", onDuplicate);
          }}
          disabled={isBusy}
          title="Duplicate"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              className="rounded p-1 text-red-600 hover:bg-red-50"
              onClick={() => void runRowAction("delete", onDelete)}
              disabled={isBusy}
              title="Confirm delete"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              onClick={() => setConfirmDelete(false)}
              disabled={isBusy}
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            disabled={isBusy}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
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
  const deleteProjectById = useProjectStore((s) => s.deleteProjectById);
  const renameProjectById = useProjectStore((s) => s.renameProjectById);
  const duplicateProjectById = useProjectStore((s) => s.duplicateProjectById);
  const isSwitchingProject = useProjectStore((s) => s.isSwitchingProject);

  const handleNewProject = useCallback(async () => {
    try {
      await createNewProject();
      setOpen(false);
    } catch (error) {
      console.error("Failed to create a new project.", error);
    }
  }, [createNewProject, setOpen]);

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
        </div>
      </DialogContent>
    </Dialog>
  );
}
