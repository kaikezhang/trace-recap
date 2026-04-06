"use client";

import { useState } from "react";
import { LogIn, LogOut, User } from "lucide-react";
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
                className="h-8 w-8"
                onClick={() => setAuthDialogOpen(true)}
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6}>
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{displayName}</p>
          {user.email && (
            <p className="text-xs text-muted-foreground">{user.email}</p>
          )}
        </div>
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
