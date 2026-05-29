import { pgTable, index, pgPolicy, check, uuid, text, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

const rlsUserMatch = sql`(user_id = current_setting('app.current_user_id', true))`

export const interviewLensRoles = pgTable("interview_lens_roles", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: text("user_id").notNull(),
  title: text().notNull(),
  seniority: text(),
  focusNotes: text("focus_notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
  index("idx_il_roles_user").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
  pgPolicy("il_roles_rls_select", { as: "permissive", for: "select", to: ["public"], using: rlsUserMatch }),
  pgPolicy("il_roles_rls_insert", { as: "permissive", for: "insert", to: ["public"], withCheck: rlsUserMatch }),
  pgPolicy("il_roles_rls_update", { as: "permissive", for: "update", to: ["public"], using: rlsUserMatch }),
  pgPolicy("il_roles_rls_delete", { as: "permissive", for: "delete", to: ["public"], using: rlsUserMatch }),
])

export const interviewLensSubmissions = pgTable("interview_lens_submissions", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: text("user_id").notNull(),
  roleId: uuid("role_id").notNull().references(() => interviewLensRoles.id, { onDelete: 'cascade' }),
  candidateName: text("candidate_name").notNull(),
  sourceType: text("source_type").notNull(),
  sourceRef: text("source_ref"),
  pastedContent: text("pasted_content"),
  repoDigest: text("repo_digest"),
  errorMessage: text("error_message"),
  status: text().notNull().default('pending'),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
  index("idx_il_submissions_user_role").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.roleId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
  index("idx_il_submissions_status").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
  check("il_submissions_source_type_check", sql`source_type IN ('github_url','pasted_code')`),
  check("il_submissions_status_check", sql`status IN ('pending','analyzing','ready','failed','interviewed')`),
  pgPolicy("il_submissions_rls_select", { as: "permissive", for: "select", to: ["public"], using: rlsUserMatch }),
  pgPolicy("il_submissions_rls_insert", { as: "permissive", for: "insert", to: ["public"], withCheck: rlsUserMatch }),
  pgPolicy("il_submissions_rls_update", { as: "permissive", for: "update", to: ["public"], using: rlsUserMatch }),
  pgPolicy("il_submissions_rls_delete", { as: "permissive", for: "delete", to: ["public"], using: rlsUserMatch }),
])

export const interviewLensBriefs = pgTable("interview_lens_briefs", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: text("user_id").notNull(),
  submissionId: uuid("submission_id").notNull().unique().references(() => interviewLensSubmissions.id, { onDelete: 'cascade' }),
  summaryMd: text("summary_md").notNull(),
  stackJson: jsonb("stack_json").notNull().default(sql`'[]'::jsonb`),
  architectureMd: text("architecture_md").notNull(),
  signalReportMd: text("signal_report_md").notNull(),
  rawModelOutput: jsonb("raw_model_output"),
  generatedAt: timestamp("generated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
  index("idx_il_briefs_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
  index("idx_il_briefs_submission").using("btree", table.submissionId.asc().nullsLast().op("uuid_ops")),
  pgPolicy("il_briefs_rls_select", { as: "permissive", for: "select", to: ["public"], using: rlsUserMatch }),
  pgPolicy("il_briefs_rls_insert", { as: "permissive", for: "insert", to: ["public"], withCheck: rlsUserMatch }),
  pgPolicy("il_briefs_rls_update", { as: "permissive", for: "update", to: ["public"], using: rlsUserMatch }),
  pgPolicy("il_briefs_rls_delete", { as: "permissive", for: "delete", to: ["public"], using: rlsUserMatch }),
])

export const interviewLensQuestions = pgTable("interview_lens_questions", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: text("user_id").notNull(),
  submissionId: uuid("submission_id").notNull().references(() => interviewLensSubmissions.id, { onDelete: 'cascade' }),
  tier: text().notNull(),
  prompt: text().notNull(),
  anchorFile: text("anchor_file"),
  strongAnswerMd: text("strong_answer_md").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  interviewerNotes: text("interviewer_notes").notNull().default(''),
  score: integer(),
  skipped: boolean().notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
  index("idx_il_questions_user_submission").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.submissionId.asc().nullsLast().op("uuid_ops"), table.sortOrder.asc().nullsLast().op("int4_ops")),
  check("il_questions_tier_check", sql`tier IN ('easy','medium','hard')`),
  check("il_questions_score_check", sql`score IS NULL OR (score BETWEEN 1 AND 5)`),
  pgPolicy("il_questions_rls_select", { as: "permissive", for: "select", to: ["public"], using: rlsUserMatch }),
  pgPolicy("il_questions_rls_insert", { as: "permissive", for: "insert", to: ["public"], withCheck: rlsUserMatch }),
  pgPolicy("il_questions_rls_update", { as: "permissive", for: "update", to: ["public"], using: rlsUserMatch }),
  pgPolicy("il_questions_rls_delete", { as: "permissive", for: "delete", to: ["public"], using: rlsUserMatch }),
])

export const interviewLensReports = pgTable("interview_lens_reports", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: text("user_id").notNull(),
  submissionId: uuid("submission_id").notNull().unique().references(() => interviewLensSubmissions.id, { onDelete: 'cascade' }),
  reportMd: text("report_md").notNull(),
  recommendationMd: text("recommendation_md").notNull(),
  hireScore: integer("hire_score").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
  index("idx_il_reports_user").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.generatedAt.desc().nullsFirst().op("timestamptz_ops")),
  check("il_reports_hire_score_check", sql`hire_score BETWEEN 0 AND 100`),
  index("idx_il_reports_submission").using("btree", table.submissionId.asc().nullsLast().op("uuid_ops")),
  pgPolicy("il_reports_rls_select", { as: "permissive", for: "select", to: ["public"], using: rlsUserMatch }),
  pgPolicy("il_reports_rls_insert", { as: "permissive", for: "insert", to: ["public"], withCheck: rlsUserMatch }),
  pgPolicy("il_reports_rls_update", { as: "permissive", for: "update", to: ["public"], using: rlsUserMatch }),
  pgPolicy("il_reports_rls_delete", { as: "permissive", for: "delete", to: ["public"], using: rlsUserMatch }),
])
