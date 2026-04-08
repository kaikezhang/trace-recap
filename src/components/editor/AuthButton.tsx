"use client";

import { useState } from "react";
import { LogIn, LogOut, MessageSquare, Trash2, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import AuthDialog from "./AuthDialog";
import MyFeedback, { useUnreadFeedbackCount } from "./MyFeedback";

export default function AuthButton() {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [myFeedbackOpen, setMyFeedbackOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const unreadCount = useUnreadFeedbackCount();

  // Hide auth UI entirely when Supabase is not configured
  if (!isSupabaseConfigured() || !initialized) return null;

  if (!user) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="touch-target-mobile h-8 w-8"
                onClick={() => setAuthDialogOpen(true)}
                aria-label="Sign in"
                style={{ color: "#78716c" }}
              >
                <LogIn className="h-4 w-4" />
              </Button>
            }
          />
          <TooltipContent side="bottom" sideOffset={6}>
            Sign in
          </TooltipContent>
        </Tooltip>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      </>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "User";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="relative touch-target-mobile h-8 w-8 rounded-full"
              aria-label="Account"
            />
          }
        >
          {avatarUrl && !avatarError ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-6 w-6 rounded-full"
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <User className="h-4 w-4" style={{ color: "#78716c" }} />
          )}
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6}>
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{displayName}</p>
            {user.email && (
              <p className="text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>
          <DropdownMenuItem onClick={() => setMyFeedbackOpen(true)}>
            <MessageSquare className="mr-2 h-4 w-4" />
            My Feedback
            {unreadCount > 0 && (
              <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteConfirm(true)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MyFeedback open={myFeedbackOpen} onOpenChange={setMyFeedbackOpen} />

      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirm(false)}>
          <div className="mx-4 max-w-sm rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-stone-900">Delete Account?</h3>
            <p className="mt-2 text-sm text-stone-600">
              This will permanently delete all your cloud-synced projects and sign you out. Local data will be cleared. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const result = await deleteAccount();
                  if (result.error) {
                    alert(`Account deletion failed: ${result.error}`);
                  }
                  setDeleteConfirm(false);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
