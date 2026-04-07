"use client";

import { useRef, useState } from "react";
import { MessageSquarePlus, Bug, Lightbulb, MessageCircle, HelpCircle, ImagePlus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brand } from "@/lib/brand";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";

type FeedbackCategory = "bug" | "feature" | "general" | "other";

const CATEGORIES: { value: FeedbackCategory; label: string; icon: typeof Bug }[] = [
  { value: "bug", label: "Bug Report", icon: Bug },
  { value: "feature", label: "Feature Request", icon: Lightbulb },
  { value: "general", label: "General", icon: MessageCircle },
  { value: "other", label: "Other", icon: HelpCircle },
];

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);

  const handleScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast({ title: "Image must be under 5MB", variant: "error" });
      return;
    }
    setScreenshot(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const clearScreenshot = () => {
    setScreenshot(null);
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    if (!isSupabaseConfigured()) {
      addToast({ title: "Feedback is not available — Supabase not configured", variant: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const context = {
        pathname: window.location.pathname,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: navigator.userAgent.slice(0, 200),
        locale: navigator.language,
      };

      if (user) {
        // 1. Create feedback record first
        const { data: feedbackId, error } = await supabase.rpc("create_feedback", {
          p_category: category,
          p_message: message.trim(),
          p_context: context,
          p_email: null,
        });
        if (error) throw error;

        // 2. Upload screenshot after feedback exists (prevents orphaned blobs)
        if (screenshot && feedbackId) {
          const ext = screenshot.name.split(".").pop() || "png";
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("feedback-screenshots")
            .upload(path, screenshot, { contentType: screenshot.type, upsert: false });

          if (!uploadError) {
            const { error: updateError } = await supabase
              .from("feedback")
              .update({ screenshot_path: path })
              .eq("id", feedbackId);
            if (updateError) {
              console.warn("[feedback] Failed to attach screenshot:", updateError.message);
              // Clean up orphaned blob
              await supabase.storage.from("feedback-screenshots").remove([path]);
            }
          } else {
            console.warn("[feedback] Screenshot upload failed:", uploadError.message);
          }
        }
      } else {
        // Anonymous: use RPC (no screenshot for anonymous)
        const { error } = await supabase.rpc("create_anonymous_feedback", {
          p_category: category,
          p_message: message.trim(),
          p_context: context,
          p_email: email.trim() || null,
        });
        if (error) throw error;
      }

      setSubmitted(true);
      addToast({ title: "Feedback sent — thank you!", variant: "success" });

      // Reset after a delay
      setTimeout(() => {
        setSubmitted(false);
        setMessage("");
        setEmail("");
        setCategory("general");
        clearScreenshot();
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      console.error("[feedback] Submit failed:", err);
      addToast({ title: "Failed to send feedback", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!submitting) {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setSubmitted(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5" style={{ color: brand.colors.primary[500] }} />
            Send Feedback
          </DialogTitle>
          <DialogDescription>
            {user
              ? "Tell us what's on your mind. We read every message."
              : "Tell us what's on your mind. Leave your email if you'd like a reply."}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center">
            <p className="text-2xl">🙏</p>
            <p className="mt-2 text-sm font-medium" style={{ color: brand.colors.warm[700] }}>
              Thank you for your feedback!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Category */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const active = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      borderColor: active ? brand.colors.primary[400] : brand.colors.warm[200],
                      backgroundColor: active ? brand.colors.primary[50] : "rgba(255,255,255,0.6)",
                      color: active ? brand.colors.primary[700] : brand.colors.warm[600],
                    }}
                    onClick={() => setCategory(cat.value)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Message */}
            <div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  category === "bug"
                    ? "Describe what happened and what you expected..."
                    : category === "feature"
                    ? "What would you like to see? How would it help?"
                    : "Your thoughts..."
                }
                rows={4}
                maxLength={5000}
                className="w-full resize-none rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]/20"
                style={{ borderColor: brand.colors.warm[200] }}
              />
              <p className="mt-1 text-right text-xs" style={{ color: brand.colors.warm[400] }}>
                {message.length}/5000
              </p>
            </div>

            {/* Screenshot (authenticated only) */}
            {user && (
              <div>
                {screenshotPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={screenshotPreview}
                      alt="Screenshot preview"
                      className="max-h-32 rounded-lg border"
                      style={{ borderColor: brand.colors.warm[200] }}
                    />
                    <button
                      type="button"
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
                      onClick={clearScreenshot}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors hover:bg-stone-50"
                    style={{ borderColor: brand.colors.warm[200], color: brand.colors.warm[600] }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Attach Screenshot
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleScreenshotSelect}
                />
              </div>
            )}

            {/* Email (anonymous only) */}
            {!user && (
              <div>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email (optional — for us to follow up)"
                  className="rounded-xl text-sm"
                  style={{ borderColor: brand.colors.warm[200] }}
                />
                <p className="mt-1 text-xs" style={{ color: brand.colors.warm[400] }}>
                  We&apos;ll only use this to respond to your feedback.
                </p>
              </div>
            )}

            {/* Submit */}
            <Button
              className="w-full rounded-xl text-white"
              style={{ backgroundColor: brand.colors.primary[500] }}
              onClick={() => void handleSubmit()}
              disabled={!message.trim() || submitting}
            >
              {submitting ? "Sending..." : "Send Feedback"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
