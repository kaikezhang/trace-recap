"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bug,
  ChevronDown,
  Filter,
  HelpCircle,
  Lightbulb,
  MessageCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brand } from "@/lib/brand";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";

type FeedbackStatus = "open" | "in_progress" | "replied" | "closed";
type FeedbackCategory = "bug" | "feature" | "general" | "other";

interface FeedbackItem {
  id: string;
  user_id: string | null;
  email: string | null;
  category: FeedbackCategory;
  message: string;
  context: Record<string, unknown>;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  replies: FeedbackReply[];
  user_email?: string;
}

interface FeedbackReply {
  id: string;
  admin_id: string;
  message: string;
  created_at: string;
}

const STATUS_COLORS: Record<FeedbackStatus, { bg: string; text: string; label: string }> = {
  open: { bg: "#fef9c3", text: "#854d0e", label: "Open" },
  in_progress: { bg: "#dbeafe", text: "#1e40af", label: "In Progress" },
  replied: { bg: "#d1fae5", text: "#065f46", label: "Replied" },
  closed: { bg: "#f3f4f6", text: "#6b7280", label: "Closed" },
};

const CATEGORY_ICONS: Record<FeedbackCategory, typeof Bug> = {
  bug: Bug,
  feature: Lightbulb,
  general: MessageCircle,
  other: HelpCircle,
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminFeedbackPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const initialize = useAuthStore((s) => s.initialize);

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  // Initialize auth
  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Check admin role
  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      router.push("/editor");
      return;
    }
    const role = user.app_metadata?.role;
    if (role !== "admin") {
      router.push("/editor");
      return;
    }
    setIsAdmin(true);
  }, [initialized, user, router]);

  // Fetch feedback
  const fetchFeedback = useCallback(async () => {
    if (!isAdmin || !isSupabaseConfigured()) return;
    const supabase = createClient();
    if (!supabase) return;

    setLoading(true);
    try {
      let query = supabase
        .from("feedback")
        .select("*, feedback_replies(*)")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;

      // Map replies and get user emails
      const items: FeedbackItem[] = (data ?? []).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        email: row.email,
        category: row.category,
        message: row.message,
        context: row.context ?? {},
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        replies: (row.feedback_replies ?? []).sort(
          (a: FeedbackReply, b: FeedbackReply) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ),
      }));

      setFeedback(items);
    } catch (err) {
      console.error("[admin] Failed to fetch feedback:", err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, statusFilter, categoryFilter]);

  useEffect(() => {
    void fetchFeedback();
  }, [fetchFeedback]);

  // Reply to feedback
  const handleReply = async (feedbackId: string) => {
    if (!replyText.trim() || !isSupabaseConfigured()) return;
    const supabase = createClient();
    if (!supabase) return;

    setReplying(true);
    try {
      const { error } = await supabase.rpc("admin_reply_feedback", {
        p_feedback_id: feedbackId,
        p_message: replyText.trim(),
      });
      if (error) throw error;

      setReplyText("");
      await fetchFeedback();
    } catch (err) {
      console.error("[admin] Reply failed:", err);
    } finally {
      setReplying(false);
    }
  };

  // Update status
  const handleStatusChange = async (feedbackId: string, status: FeedbackStatus) => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    if (!supabase) return;

    try {
      const { error } = await supabase.rpc("admin_update_feedback_status", {
        p_feedback_id: feedbackId,
        p_status: status,
      });
      if (error) throw error;
      await fetchFeedback();
    } catch (err) {
      console.error("[admin] Status update failed:", err);
    }
  };

  if (!isAdmin || !initialized) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: "#fffbf5" }}>
        <p style={{ color: brand.colors.warm[500] }}>Loading...</p>
      </div>
    );
  }

  const filteredCount = feedback.length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#fffbf5" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 border-b px-4 py-3 md:px-6"
        style={{ backgroundColor: "#fffbf5", borderColor: brand.colors.warm[200] }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/editor")}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-stone-100"
            >
              <ArrowLeft className="h-4 w-4" style={{ color: brand.colors.warm[600] }} />
            </button>
            <div>
              <h1 className="text-lg font-semibold" style={{ color: brand.colors.warm[900], fontFamily: brand.fonts.display }}>
                Feedback
              </h1>
              <p className="text-xs" style={{ color: brand.colors.warm[500] }}>
                {filteredCount} item{filteredCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <button
            onClick={() => void fetchFeedback()}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-stone-100"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} style={{ color: brand.colors.warm[500] }} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4" style={{ color: brand.colors.warm[400] }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | "all")}
            className="rounded-lg border bg-white px-3 py-1.5 text-xs"
            style={{ borderColor: brand.colors.warm[200], color: brand.colors.warm[700] }}
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="replied">Replied</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as FeedbackCategory | "all")}
            className="rounded-lg border bg-white px-3 py-1.5 text-xs"
            style={{ borderColor: brand.colors.warm[200], color: brand.colors.warm[700] }}
          >
            <option value="all">All Categories</option>
            <option value="bug">Bug</option>
            <option value="feature">Feature</option>
            <option value="general">General</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Feedback list */}
        {loading && feedback.length === 0 ? (
          <p className="py-12 text-center text-sm" style={{ color: brand.colors.warm[400] }}>
            Loading feedback...
          </p>
        ) : feedback.length === 0 ? (
          <p className="py-12 text-center text-sm" style={{ color: brand.colors.warm[400] }}>
            No feedback yet.
          </p>
        ) : (
          <div className="space-y-3">
            {feedback.map((item) => {
              const isExpanded = expandedId === item.id;
              const statusConfig = STATUS_COLORS[item.status];
              const CategoryIcon = CATEGORY_ICONS[item.category];
              const contactEmail = item.email || (item.user_id ? "(registered user)" : "(anonymous)");

              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-2xl border"
                  style={{
                    borderColor: isExpanded ? brand.colors.primary[200] : brand.colors.warm[200],
                    backgroundColor: "rgba(255,255,255,0.8)",
                    boxShadow: isExpanded ? brand.shadows.md : brand.shadows.sm,
                  }}
                >
                  {/* Card header */}
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50/50"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <CategoryIcon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: brand.colors.warm[500] }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug" style={{ color: brand.colors.warm[800] }}>
                        {item.message.length > 120 ? item.message.slice(0, 120) + "..." : item.message}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs" style={{ color: brand.colors.warm[400] }}>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: statusConfig.bg, color: statusConfig.text }}
                        >
                          {statusConfig.label}
                        </span>
                        <span>{item.category}</span>
                        <span>·</span>
                        <span>{contactEmail}</span>
                        <span>·</span>
                        <span>{formatDate(item.created_at)}</span>
                        {item.replies.length > 0 && (
                          <>
                            <span>·</span>
                            <span>{item.replies.length} repl{item.replies.length === 1 ? "y" : "ies"}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={`mt-1 h-4 w-4 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      style={{ color: brand.colors.warm[400] }}
                    />
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t px-4 py-3" style={{ borderColor: brand.colors.warm[100] }}>
                      {/* Full message */}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: brand.colors.warm[700] }}>
                        {item.message}
                      </p>

                      {/* Context */}
                      {Object.keys(item.context).length > 0 && (
                        <div className="mt-3 rounded-lg p-2.5 text-xs" style={{ backgroundColor: brand.colors.warm[50], color: brand.colors.warm[500] }}>
                          {Object.entries(item.context).map(([key, val]) => (
                            <div key={key} className="flex gap-2">
                              <span className="shrink-0 font-medium">{key}:</span>
                              <span className="truncate">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Status controls */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(["open", "in_progress", "replied", "closed"] as FeedbackStatus[]).map((s) => {
                          const c = STATUS_COLORS[s];
                          const active = item.status === s;
                          return (
                            <button
                              key={s}
                              className="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                              style={{
                                backgroundColor: active ? c.bg : "transparent",
                                borderColor: active ? c.text + "40" : brand.colors.warm[200],
                                color: active ? c.text : brand.colors.warm[500],
                              }}
                              onClick={() => void handleStatusChange(item.id, s)}
                            >
                              {c.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Replies */}
                      {item.replies.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-medium" style={{ color: brand.colors.warm[600] }}>Replies</p>
                          {item.replies.map((reply) => (
                            <div
                              key={reply.id}
                              className="rounded-xl px-3 py-2"
                              style={{ backgroundColor: brand.colors.primary[50] }}
                            >
                              <p className="text-sm" style={{ color: brand.colors.warm[700] }}>
                                {reply.message}
                              </p>
                              <p className="mt-1 text-xs" style={{ color: brand.colors.warm[400] }}>
                                {formatDate(reply.created_at)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply form */}
                      <div className="mt-4 flex gap-2">
                        <Input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write a reply..."
                          className="flex-1 rounded-xl text-sm"
                          style={{ borderColor: brand.colors.warm[200] }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void handleReply(item.id);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="shrink-0 rounded-xl text-white"
                          style={{ backgroundColor: brand.colors.primary[500] }}
                          disabled={!replyText.trim() || replying}
                          onClick={() => void handleReply(item.id)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
