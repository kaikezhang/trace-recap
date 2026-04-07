-- ============================================================================
-- 004_feedback.sql — User feedback system with admin replies
-- ============================================================================

-- Enums
CREATE TYPE feedback_status AS ENUM ('open', 'in_progress', 'replied', 'closed');
CREATE TYPE feedback_category AS ENUM ('bug', 'feature', 'general', 'other');

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  email text,
  category feedback_category NOT NULL DEFAULT 'general',
  message text NOT NULL CHECK (char_length(message) > 0 AND char_length(message) <= 5000),
  context jsonb NOT NULL DEFAULT '{}',
  screenshot_path text,
  status feedback_status NOT NULL DEFAULT 'open',
  last_user_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feedback_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES auth.users,
  message text NOT NULL CHECK (char_length(message) > 0 AND char_length(message) <= 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_feedback_status_created ON feedback (status, created_at DESC);
CREATE INDEX idx_feedback_user_created ON feedback (user_id, created_at DESC);
CREATE INDEX idx_feedback_category ON feedback (category);
CREATE INDEX idx_replies_feedback ON feedback_replies (feedback_id, created_at);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at on feedback changes
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_feedback_updated_at();

-- Auto-set status to 'replied' when admin replies (unless closed)
CREATE OR REPLACE FUNCTION set_feedback_replied()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE feedback
  SET status = 'replied', updated_at = now()
  WHERE id = NEW.feedback_id AND status != 'closed';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feedback_reply_status
  AFTER INSERT ON feedback_replies
  FOR EACH ROW EXECUTE FUNCTION set_feedback_replied();

-- ============================================================================
-- Admin helper
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_replies ENABLE ROW LEVEL SECURITY;

-- Feedback: users read their own
CREATE POLICY feedback_select_own ON feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- Feedback: admins can update status/etc
CREATE POLICY feedback_update_admin ON feedback
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Feedback: users can update their own last_user_viewed_at
CREATE POLICY feedback_update_viewed ON feedback
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Replies: users read replies to their own feedback
CREATE POLICY replies_select_own ON feedback_replies
  FOR SELECT TO authenticated
  USING (
    feedback_id IN (SELECT id FROM feedback WHERE user_id = auth.uid())
    OR is_admin()
  );

-- Replies: only through RPC (no direct INSERT policy for replies)

-- ============================================================================
-- RPC Functions (least-privilege mutations)
-- ============================================================================

-- Submit feedback (authenticated users)
CREATE OR REPLACE FUNCTION create_feedback(
  p_category feedback_category,
  p_message text,
  p_context jsonb DEFAULT '{}',
  p_email text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO feedback (user_id, email, category, message, context)
  VALUES (auth.uid(), p_email, p_category, p_message, p_context)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit feedback (anonymous — callable from Edge Function with service role)
CREATE OR REPLACE FUNCTION create_anonymous_feedback(
  p_category feedback_category,
  p_message text,
  p_context jsonb DEFAULT '{}',
  p_email text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO feedback (user_id, email, category, message, context)
  VALUES (NULL, p_email, p_category, p_message, p_context)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin reply
CREATE OR REPLACE FUNCTION admin_reply_feedback(
  p_feedback_id uuid,
  p_message text
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  INSERT INTO feedback_replies (feedback_id, admin_id, message)
  VALUES (p_feedback_id, auth.uid(), p_message)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin update status
CREATE OR REPLACE FUNCTION admin_update_feedback_status(
  p_feedback_id uuid,
  p_status feedback_status
) RETURNS void AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  UPDATE feedback SET status = p_status WHERE id = p_feedback_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- User marks feedback as viewed (for unread tracking)
CREATE OR REPLACE FUNCTION mark_feedback_viewed(
  p_feedback_id uuid
) RETURNS void AS $$
BEGIN
  UPDATE feedback
  SET last_user_viewed_at = now()
  WHERE id = p_feedback_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread feedback count (for badge)
CREATE OR REPLACE FUNCTION get_unread_feedback_count()
RETURNS integer AS $$
  SELECT count(*)::integer
  FROM feedback f
  WHERE f.user_id = auth.uid()
    AND f.status = 'replied'
    AND EXISTS (
      SELECT 1 FROM feedback_replies r
      WHERE r.feedback_id = f.id
        AND r.created_at > coalesce(f.last_user_viewed_at, '1970-01-01')
    );
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- Storage bucket for feedback screenshots
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users upload to their own folder
CREATE POLICY feedback_screenshots_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users read their own screenshots
CREATE POLICY feedback_screenshots_own_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins read all screenshots
CREATE POLICY feedback_screenshots_admin_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'feedback-screenshots' AND is_admin());
