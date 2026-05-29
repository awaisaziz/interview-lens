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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- For existing installs that predate updated_at on roles
ALTER TABLE interview_lens_roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- For existing installs that predate updated_at on submissions
ALTER TABLE interview_lens_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

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
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_il_briefs_user ON interview_lens_briefs(user_id);
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
  score INTEGER CHECK (score IS NULL OR (score BETWEEN 1 AND 5)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  skipped BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_il_questions_user_submission ON interview_lens_questions(user_id, submission_id, sort_order);
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

-- ─── reports ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_lens_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL,
  submission_id  UUID NOT NULL REFERENCES interview_lens_submissions(id) ON DELETE CASCADE,
  report_md      TEXT NOT NULL,
  recommendation_md TEXT NOT NULL,
  hire_score     INTEGER NOT NULL CHECK (hire_score BETWEEN 0 AND 100),
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id, user_id)
);
-- For existing installs that predate updated_at on reports
ALTER TABLE interview_lens_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_il_reports_user ON interview_lens_reports(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_il_reports_submission ON interview_lens_reports(submission_id);
ALTER TABLE interview_lens_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS il_reports_rls_select ON interview_lens_reports;
CREATE POLICY il_reports_rls_select ON interview_lens_reports FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_reports_rls_insert ON interview_lens_reports;
CREATE POLICY il_reports_rls_insert ON interview_lens_reports FOR INSERT
  WITH CHECK (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_reports_rls_update ON interview_lens_reports;
CREATE POLICY il_reports_rls_update ON interview_lens_reports FOR UPDATE
  USING (user_id = current_setting('app.current_user_id', true));
DROP POLICY IF EXISTS il_reports_rls_delete ON interview_lens_reports;
CREATE POLICY il_reports_rls_delete ON interview_lens_reports FOR DELETE
  USING (user_id = current_setting('app.current_user_id', true));

-- Foreign key constraints to Better Auth user table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_interview_lens_roles_user' AND conrelid = 'interview_lens_roles'::regclass) THEN
    ALTER TABLE interview_lens_roles ADD CONSTRAINT fk_interview_lens_roles_user FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_interview_lens_submissions_user' AND conrelid = 'interview_lens_submissions'::regclass) THEN
    ALTER TABLE interview_lens_submissions ADD CONSTRAINT fk_interview_lens_submissions_user FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_interview_lens_briefs_user' AND conrelid = 'interview_lens_briefs'::regclass) THEN
    ALTER TABLE interview_lens_briefs ADD CONSTRAINT fk_interview_lens_briefs_user FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_interview_lens_questions_user' AND conrelid = 'interview_lens_questions'::regclass) THEN
    ALTER TABLE interview_lens_questions ADD CONSTRAINT fk_interview_lens_questions_user FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_interview_lens_reports_user' AND conrelid = 'interview_lens_reports'::regclass) THEN
    ALTER TABLE interview_lens_reports ADD CONSTRAINT fk_interview_lens_reports_user FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
