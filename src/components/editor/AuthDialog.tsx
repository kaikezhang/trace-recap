"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loading = useAuthStore((s) => s.loading);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const signUpWithEmail = useAuthStore((s) => s.signUpWithEmail);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    if (mode === "signin") {
      const result = await signInWithEmail(email, password);
      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
        resetForm();
      }
    } else {
      const result = await signUpWithEmail(email, password);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccessMessage("Check your email for a confirmation link.");
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    await signInWithGoogle();
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setError("");
    setSuccessMessage("");
  };

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setError("");
    setSuccessMessage("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "signin" ? "Sign In" : "Create Account"}
          </DialogTitle>
          <DialogDescription>
            {mode === "signin"
              ? "Sign in to sync your projects across devices."
              : "Create an account to save your projects to the cloud."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
            />

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            {successMessage && (
              <p className="text-sm text-emerald-600">{successMessage}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading
                ? "..."
                : mode === "signin"
                  ? "Sign In"
                  : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            {mode === "signin" ? (
              <>
                No account?{" "}
                <button
                  className="underline hover:text-foreground"
                  onClick={switchMode}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  className="underline hover:text-foreground"
                  onClick={switchMode}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
