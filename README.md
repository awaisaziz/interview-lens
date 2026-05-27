# Interview Lens — an ARI module

Turn a candidate's take-home project into a structured interview brief in seconds, not an hour. Tells you the difference between a candidate who **built** their project and one who **prompted** it.

> Built for the [ARI](https://github.com/) personal OS — drop the folder into `modules-custom/interview-lens/` of an ARI install, restart, and the schema, sidebar entry, dashboard widget, and settings panel wire themselves up.

## What it does

- **Ingest** a candidate submission as pasted code/README (primary) or a public GitHub URL (secondary, best-effort).
- **Analyze** with one OpenAI Structured-Outputs call that returns:
  - A plain-language project summary
  - Detected stack
  - Architecture notes
  - Tiered (easy / medium / hard) interview questions, each tied to a specific file, with a *strong-answer rubric* so even a non-expert interviewer can evaluate responses
  - A **signal report** flagging where the candidate made real decisions vs where the code looks like untouched AI scaffolding
- **Capture** interviewer notes and 1–5 scores per question, live, on the detail page.
- **Pipeline view** on the dashboard groups candidates by role with average scores.

## Installation

```bash
# from the root of an ARI clone
cp -R ari-interview-lens modules-custom/interview-lens
pnpm install
node scripts/generate-module-registry.js
# add OPENAI_API_KEY=sk-... to .env.local
./ari start   # or .\ari.cmd start on Windows
```

Then in the ARI UI:

1. Settings → Interview Lens → add at least one role (with focus notes — what your team cares about for this position).
2. `/interview-lens/new` → submit a candidate.
3. On the submission page, click **Generate brief**.
4. Walk the brief and questions during the live interview, jot notes, score 1–5 per question.

## Security model

The candidate's project is **untrusted input**. The module's defenses:

| Risk | Mitigation |
|---|---|
| Prompt injection in README/code | Candidate text is wrapped in `<UNTRUSTED_CANDIDATE_INPUT>` tags. The system message tells the model to treat everything inside as data, ignore directives, and flag injection attempts in the signal report. |
| Model schema drift | Uses OpenAI **Structured Outputs** (`json_schema`, `strict: true`), then re-validates with Zod before persisting. Anything off-schema → `status='failed'` with a stored `error_message`, never a partial write. |
| Markdown XSS | Rendered with `react-markdown` + `rehype-sanitize`. Raw HTML stripped. |
| Tenant isolation | Every API route calls `getAuthenticatedUser()` + `withRLS()`. RLS policies use `current_setting('app.current_user_id', true)` so a missing setting returns NULL rather than throwing. |
| GitHub rate-limit (60/hr unauth) | Paste is the primary path. GitHub is single-attempt with graceful "paste instead" fallback. The digest is **persisted on the submission row** so re-analyze never refetches. |
| Sensitive raw model output | Stored in `raw_model_output` JSONB for server-side debug only — never rendered in the UI. |
| Zip-bomb / path traversal | Zip upload is **not implemented** in v1. Documented as future work. |

## Architecture

```
modules-custom/interview-lens/
├── module.json              # ARI manifest
├── database/
│   ├── schema.sql           # idempotent, RLS-enabled, auto-applies on enable
│   ├── schema.ts            # Drizzle table definitions
│   └── uninstall.sql        # manual-only teardown
├── api/
│   ├── roles/               # CRUD
│   ├── submissions/
│   │   ├── route.ts         # ingest (builds + persists repo_digest)
│   │   └── [id]/
│   │       ├── route.ts     # detail (brief + questions joined)
│   │       └── analyze/     # one-shot OpenAI call, transactional persist
│   ├── questions/[id]/      # PATCH notes/score
│   ├── pipeline/            # rollup for dashboard widget
│   └── settings/            # JSONB upsert
├── app/                     # /interview-lens UI (list, new, detail)
├── components/              # widget, settings panel, role manager, etc.
├── hooks/                   # TanStack Query
├── lib/
│   ├── digest.ts            # ingest → repo_digest (paste + GitHub paths)
│   ├── prompts.ts           # system + user prompt with injection guard
│   ├── openai.ts            # raw-fetch client, Structured Outputs
│   └── validation.ts        # Zod schemas (request + model output) + JSON Schema
└── types/
```

## License

MIT
