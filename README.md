# Interview Lens

An ARI module that turns a candidate's take-home project into a structured interview brief.

## What it does

- Ingest a candidate submission as **pasted code/README** (primary) or a **public GitHub URL** (secondary).
- Run a one-shot OpenAI Structured-Outputs call that returns:
  - Plain-language project summary
  - Detected stack
  - Architecture notes
  - Tiered (easy / medium / hard) interview questions, each tied to a file with a strong-answer rubric
  - **Signal report** flagging hand-crafted vs AI-scaffolded code and sophistication mismatches
- Capture interviewer notes + 1–5 scores per question, live, on the detail page.
- Dashboard widget shows a candidate pipeline grouped by role.

## Setup

1. Drop an `OPENAI_API_KEY=sk-...` into `.env.local`.
2. Enable the module from Settings → Features (or it auto-installs on first boot since `enabled: true`).
3. Open Settings → Interview Lens → create a role with focus notes.
4. Visit `/interview-lens/new` to submit a candidate.

## Security notes (built in)

- All routes use `getAuthenticatedUser()` + `withRLS()` — strict per-user isolation.
- RLS policies use `current_setting('app.current_user_id', true)` so a missing setting returns NULL instead of throwing.
- Candidate input is wrapped in `<UNTRUSTED_CANDIDATE_INPUT>` tags in the LLM prompt; the system message instructs the model to treat it as data, not instructions, and to flag injection attempts.
- OpenAI **Structured Outputs** (`json_schema`, `strict: true`) is used — then re-validated with Zod before persisting.
- Markdown is rendered with `react-markdown` + `rehype-sanitize` (no raw HTML).
- `raw_model_output` is stored DB-only for debugging; it is never rendered in the UI.

## Future work

- **Zip upload ingestion.** Cut from v1 because zip bombs, path traversal, MIME validation, and storage cleanup are too many failure modes for a 2-hour build. The schema already separates `source_type`, so adding an `uploaded_zip` path later is non-breaking.
- Multi-call LLM pipeline (separate summary / questions / signal calls) for richer briefs.
- Re-analyze with a different model / prompt without dropping interviewer notes.
