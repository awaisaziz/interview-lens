import { z } from 'zod'
import '@/lib/openapi/registry'

const uuid = z.string().uuid()

export const createRoleSchema = z.object({
  title: z.string().min(1).max(200),
  seniority: z.string().max(100).nullable().optional(),
  focus_notes: z.string().max(4000).nullable().optional(),
}).openapi('InterviewLensCreateRole')

export const updateRoleSchema = createRoleSchema.partial().openapi('InterviewLensUpdateRole')

export const createSubmissionSchema = z.object({
  role_id: uuid,
  candidate_name: z.string().min(1).max(200),
  source_type: z.enum(['github_url', 'pasted_code']),
  source_ref: z.string().url().max(500).nullable().optional(),
  pasted_content: z.string().max(200_000).nullable().optional(),
}).refine(
  (v) => (v.source_type === 'github_url' ? !!v.source_ref : !!v.pasted_content),
  { message: 'github_url requires source_ref; pasted_code requires pasted_content' },
).openapi('InterviewLensCreateSubmission')

export const updateQuestionSchema = z.object({
  interviewer_notes: z.string().max(8000).optional(),
  score: z.number().int().min(1).max(5).nullable().optional(),
  skipped: z.boolean().optional(),
}).openapi('InterviewLensUpdateQuestion')

export const settingsSchema = z.object({
  onboardingCompleted: z.boolean().optional(),
  defaultModel: z.enum(['gpt-4o-2024-08-06', 'gpt-4o-mini']).optional(),
}).strict().openapi('InterviewLensSettings')

// ─── Model output schema ─────────────────────────────────────────────────
// This is the shape we demand from OpenAI Structured Outputs AND re-validate
// with Zod after the call. Defense in depth.

const stackItem = z.object({
  name: z.string().min(1).max(80),
  role: z.string().min(1).max(200),
}).strict()

const questionItem = z.object({
  tier: z.enum(['easy', 'medium', 'hard']),
  prompt: z.string().min(1).max(2000),
  anchor_file: z.string().max(500).nullable(),
  strong_answer_md: z.string().min(1).max(4000),
}).strict()

export const briefOutputSchema = z.object({
  summary_md: z.string().min(1).max(8000),
  stack: z.array(stackItem).max(40),
  architecture_md: z.string().min(1).max(8000),
  questions: z.array(questionItem).min(3).max(30),
  signal_report_md: z.string().min(1).max(8000),
}).strict()

export type BriefOutput = z.infer<typeof briefOutputSchema>

// ─── Report output schema ────────────────────────────────────────────────
export const reportOutputSchema = z.object({
  report_md: z.string().min(1).max(12000),
  recommendation_md: z.string().min(1).max(4000),
  hire_score: z.number().int().min(0).max(100),
}).strict()

export type ReportOutput = z.infer<typeof reportOutputSchema>

export const reportJsonSchema = {
  name: 'interview_report',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['report_md', 'recommendation_md', 'hire_score'],
    properties: {
      report_md: { type: 'string' },
      recommendation_md: { type: 'string' },
      hire_score: { type: 'integer' },
    },
  },
} as const

// JSON Schema mirror for OpenAI's response_format. Kept hand-rolled (not
// auto-converted from Zod) so we have full control over `additionalProperties`
// and required arrays, which the strict mode of Structured Outputs needs.
export const briefJsonSchema = {
  name: 'interview_brief',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary_md', 'stack', 'architecture_md', 'questions', 'signal_report_md'],
    properties: {
      summary_md: { type: 'string' },
      stack: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'role'],
          properties: {
            name: { type: 'string' },
            role: { type: 'string' },
          },
        },
      },
      architecture_md: { type: 'string' },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['tier', 'prompt', 'anchor_file', 'strong_answer_md'],
          properties: {
            tier: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            prompt: { type: 'string' },
            anchor_file: { type: ['string', 'null'] },
            strong_answer_md: { type: 'string' },
          },
        },
      },
      signal_report_md: { type: 'string' },
    },
  },
} as const
