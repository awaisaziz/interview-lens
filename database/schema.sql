-- Interview Lens schema. Idempotent — safe to re-run on every module enable.
-- Mirrors modules-custom/interview-lens/database/schema.ts
-- RLS policies use current_setting('app.current_user_id', true) so a missing
-- setting returns NULL rather than raising — extra safety against config drift.

-- ─── roles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_lens_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  seniority TEXT,
  focus_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_il_roles_user ON interview_lens_roles(user_id, created_at DESC);
ALTER TABLE interview_lens_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS il_roles_rls_select ON interview_lens_roles;
CREATE POLICY il_roles_rls_select ON interview_lens_roles FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_roles_rls_insert ON interview_lens_roles;
CREATE POLICY il_roles_rls_insert ON interview_lens_roles FOR INSERT
  WITH CHECK (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_roles_rls_update ON interview_lens_roles;
CREATE POLICY il_roles_rls_update ON interview_lens_roles FOR UPDATE
  USING (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_roles_rls_delete ON interview_lens_roles;
CREATE POLICY il_roles_rls_delete ON interview_lens_roles FOR DELETE
  USING (user_id = current_setting('app.current_user_id', true));

-- ─── submissions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_lens_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES interview_lens_roles(id) ON DELETE CASCADE,
  candidate_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('github_url','pasted_code')),
  source_ref TEXT,
  pasted_content TEXT,
  repo_digest TEXT,
  error_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','analyzing','ready','failed','interviewed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_il_submissions_user_role ON interview_lens_submissions(user_id, role_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_il_submissions_status ON interview_lens_submissions(user_id, status);
ALTER TABLE interview_lens_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS il_submissions_rls_select ON interview_lens_submissions;
CREATE POLICY il_submissions_rls_select ON interview_lens_submissions FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_submissions_rls_insert ON interview_lens_submissions;
CREATE POLICY il_submissions_rls_insert ON interview_lens_submissions FOR INSERT
  WITH CHECK (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_submissions_rls_update ON interview_lens_submissions;
CREATE POLICY il_submissions_rls_update ON interview_lens_submissions FOR UPDATE
  USING (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_submissions_rls_delete ON interview_lens_submissions;
CREATE POLICY il_submissions_rls_delete ON interview_lens_submissions FOR DELETE
  USING (user_id = current_setting('app.current_user_id', true));

-- ─── briefs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_lens_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  submission_id UUID NOT NULL UNIQUE REFERENCES interview_lens_submissions(id) ON DELETE CASCADE,
  summary_md TEXT NOT NULL,
  stack_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  architecture_md TEXT NOT NULL,
  signal_report_md TEXT NOT NULL,
  raw_model_output JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_il_briefs_submission ON interview_lens_briefs(submission_id);
ALTER TABLE interview_lens_briefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS il_briefs_rls_select ON interview_lens_briefs;
CREATE POLICY il_briefs_rls_select ON interview_lens_briefs FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_briefs_rls_insert ON interview_lens_briefs;
CREATE POLICY il_briefs_rls_insert ON interview_lens_briefs FOR INSERT
  WITH CHECK (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_briefs_rls_update ON interview_lens_briefs;
CREATE POLICY il_briefs_rls_update ON interview_lens_briefs FOR UPDATE
  USING (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_briefs_rls_delete ON interview_lens_briefs;
CREATE POLICY il_briefs_rls_delete ON interview_lens_briefs FOR DELETE
  USING (user_id = current_setting('app.current_user_id', true));

-- ─── questions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_lens_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  submission_id UUID NOT NULL REFERENCES interview_lens_submissions(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('easy','medium','hard')),
  prompt TEXT NOT NULL,
  anchor_file TEXT,
  strong_answer_md TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  interviewer_notes TEXT NOT NULL DEFAULT '',
  score INTEGER CHECK (score IS NULL OR (score BETWEEN 1 AND 5))
);
CREATE INDEX IF NOT EXISTS idx_il_questions_submission ON interview_lens_questions(submission_id, sort_order);
ALTER TABLE interview_lens_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS il_questions_rls_select ON interview_lens_questions;
CREATE POLICY il_questions_rls_select ON interview_lens_questions FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_questions_rls_insert ON interview_lens_questions;
CREATE POLICY il_questions_rls_insert ON interview_lens_questions FOR INSERT
  WITH CHECK (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_questions_rls_update ON interview_lens_questions;
CREATE POLICY il_questions_rls_update ON interview_lens_questions FOR UPDATE
  USING (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_questions_rls_delete ON interview_lens_questions;
CREATE POLICY il_questions_rls_delete ON interview_lens_questions FOR DELETE
  USING (user_id = current_setting('app.current_user_id', true));
