"use client";

import { useState } from "react";
import { LogIn, LogOut, MessageSquare, User } from "lucide-react";
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
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const signOut = useAuthStore((s) => s.signOut);

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

  const [myFeedbackOpen, setMyFeedbackOpen] = useState(false);
  const unreadCount = useUnreadFeedbackCount();

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
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-6 w-6 rounded-full"
              referrerPolicy="no-referrer"
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
        </DropdownMenuContent>
      </DropdownMenu>

      <MyFeedback open={myFeedbackOpen} onOpenChange={setMyFeedbackOpen} />
    </>
  );
}
