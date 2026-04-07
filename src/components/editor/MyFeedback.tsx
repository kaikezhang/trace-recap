"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { brand } from "@/lib/brand";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";

interface MyFeedbackItem {
  id: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
  last_user_viewed_at: string | null;
  replies: { id: string; message: string; created_at: string }[];
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  replied: "Replied",
  closed: "Closed",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays < 1) return "Today";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface MyFeedbackProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MyFeedback({ open, onOpenChange }: MyFeedbackProps) {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<MyFeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return;
    const supabase = createClient();
    if (!supabase) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("*, feedback_replies(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setItems(
        (data ?? []).map((row) => ({
          id: row.id,
          category: row.category,
          message: row.message,
          status: row.status,
          created_at: row.created_at,
          last_user_viewed_at: row.last_user_viewed_at,
          replies: (row.feedback_replies ?? []).sort(
            (a: { created_at: string }, b: { created_at: string }) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          ),
        })),
      );
    } catch (err) {
      console.error("[feedback] Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) void fetchItems();
  }, [open, fetchItems]);

  // Mark as viewed when expanded + update local state immediately
  const handleExpand = async (itemId: string) => {
    const isCollapsing = expandedId === itemId;
    setExpandedId(isCollapsing ? null : itemId);

    if (isCollapsing) return;

    // Immediately update local state so unread indicator clears
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, last_user_viewed_at: now } : item,
      ),
    );

    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    if (!supabase) return;

    try {
      await supabase.rpc("mark_feedback_viewed", { p_feedback_id: itemId });
    } catch {
      // silent — local state already updated
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" style={{ color: brand.colors.primary[500] }} />
            My Feedback
          </DialogTitle>
          <DialogDescription>
            Your submitted feedback and admin replies.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm" style={{ color: brand.colors.warm[400] }}>
            Loading...
          </p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: brand.colors.warm[400] }}>
            No feedback submitted yet.
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {items.map((item) => {
              const isExpanded = expandedId === item.id;
              const hasUnreadReply =
                item.status === "replied" &&
                item.replies.some(
                  (r) =>
                    !item.last_user_viewed_at ||
                    new Date(r.created_at) > new Date(item.last_user_viewed_at),
                );

              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-xl border"
                  style={{
                    borderColor: hasUnreadReply ? brand.colors.primary[300] : brand.colors.warm[200],
                    backgroundColor: hasUnreadReply ? brand.colors.primary[50] : "rgba(255,255,255,0.8)",
                  }}
                >
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
                    onClick={() => void handleExpand(item.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug" style={{ color: brand.colors.warm[700] }}>
                        {item.message.length > 80 ? item.message.slice(0, 80) + "..." : item.message}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: brand.colors.warm[400] }}>
                        <span>{item.category}</span>
                        <span>·</span>
                        <span>{STATUS_LABELS[item.status] ?? item.status}</span>
                        <span>·</span>
                        <span>{formatDate(item.created_at)}</span>
                        {hasUnreadReply && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ backgroundColor: brand.colors.primary[500], color: "white" }}
                          >
                            New reply
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={`mt-1 h-3.5 w-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      style={{ color: brand.colors.warm[400] }}
                    />
                  </button>

                  {isExpanded && (
                    <div className="border-t px-3 py-2.5" style={{ borderColor: brand.colors.warm[100] }}>
                      <p className="whitespace-pre-wrap text-sm" style={{ color: brand.colors.warm[600] }}>
                        {item.message}
                      </p>

                      {item.replies.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {item.replies.map((reply) => (
                            <div
                              key={reply.id}
                              className="rounded-lg px-3 py-2"
                              style={{ backgroundColor: brand.colors.ocean[50] }}
                            >
                              <p className="text-xs font-medium" style={{ color: brand.colors.ocean[700] }}>
                                Admin reply
                              </p>
                              <p className="mt-0.5 text-sm" style={{ color: brand.colors.warm[700] }}>
                                {reply.message}
                              </p>
                              <p className="mt-1 text-xs" style={{ color: brand.colors.warm[400] }}>
                                {formatDate(reply.created_at)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Hook to get unread feedback count for badge display */
export function useUnreadFeedbackCount(): number {
  const user = useAuthStore((s) => s.user);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) {
      setCount(0);
      return;
    }

    const fetchCount = async () => {
      const supabase = createClient();
      if (!supabase) return;

      try {
        const { data, error } = await supabase.rpc("get_unread_feedback_count");
        if (!error && typeof data === "number") {
          setCount(data);
        }
      } catch {
        // silent
      }
    };

    void fetchCount();
    // Poll every 60 seconds
    const interval = setInterval(() => void fetchCount(), 60000);
    return () => clearInterval(interval);
  }, [user]);

  return count;
}
