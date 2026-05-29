-- Interview Lens — manual teardown. Never auto-runs.
-- Run only if you intentionally want to remove all data.

DROP TABLE IF EXISTS interview_lens_reports CASCADE;
DROP TABLE IF EXISTS interview_lens_questions CASCADE;
DROP TABLE IF EXISTS interview_lens_briefs CASCADE;
DROP TABLE IF EXISTS interview_lens_submissions CASCADE;
DROP TABLE IF EXISTS interview_lens_roles CASCADE;
