# Interview Lens — an ARI module

Turn a candidate's take-home project into a structured interview brief in seconds, not an hour. Tells you the difference between a candidate who **built** their project and one who **prompted** it.

> Built for the [ARI](https://github.com/) personal OS — drop the folder into `modules-custom/interview-lens/` of an ARI install, restart, and the schema, sidebar entry, dashboard widget, and settings panel wire themselves up.

## Demo

📺 **[Watch the demo on YouTube](https://youtu.be/WTiUOTfy5jc)**

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

### 1. Clone the module into your ARI install

From the root of your ARI clone, pull this repo directly into the `modules-custom` folder (ensure you are inside the `modules-custom` folder):

```bash
git clone https://github.com/awaisaziz/interview-lens.git interview-lens
```

> **Windows (PowerShell)**
> ```powershell
> git clone https://github.com/awaisaziz/interview-lens.git interview-lens
> ```

### 2. Run the module audit

The ARI module audit checks the module is well-formed and ready to activate:

```bash
# Claude Code CLI (recommended)
claude /ari-audit-module interview-lens
```

Or manually verify that `module.json` is present and the database schema looks correct — but the audit command does this automatically.

### 3. Install dependencies and activate
Make sure you are in the `ARI` folder
```bash
pnpm install
node scripts/generate-module-registry.js
```

Add your OpenAI key to `.env.local`:

```env
OPENAI_API_KEY=sk-...
```

Then start ARI:

```bash
./ari start        # macOS / Linux
.\ari.cmd start    # Windows
```

### 4. Enable the module in ARI

After restarting ARI, the module is installed but **disabled by default** — it will not appear in the sidebar yet.

To enable it:

1. Open ARI in your browser at `http://localhost:3000`
2. Go to **Settings → Modules** (or navigate directly to `/modules`)
3. Find **Interview Lens** in the module list
4. Click the toggle to **enable** it
5. The page will reload — **Interview Lens** will now appear in the left sidebar under the *Hiring* group

> **If you don't see it in the sidebar after enabling**, try a hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`) or restart the dev server. The sidebar reads module state from the database so a fresh session always picks it up.

### 5. Configure and use

1. Go to **Settings → Interview Lens** and add at least one **role** (give it focus notes — what your team actually cares about for this position).
2. Click **New submission** in the sidebar (or go to `/interview-lens/new`).
3. Pick the role, enter the candidate's name, and paste their code or provide a public GitHub URL.
4. Click **Create submission** — ARI ingests the code and runs the AI analysis automatically.
5. On the submission detail page, walk through the generated questions during the live interview, jot notes, and score each question 1–5.
6. When done, click **Generate report** to produce the final hire/no-hire recommendation.

### Updating

To pull the latest version of the module:

```bash
cd modules-custom/interview-lens
git pull
cd ../..
node scripts/generate-module-registry.js
./ari start   # restart to pick up any schema changes
```

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
