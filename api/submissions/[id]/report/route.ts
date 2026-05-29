import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import {
  interviewLensSubmissions,
  interviewLensBriefs,
  interviewLensQuestions,
  interviewLensRoles,
  interviewLensReports,
} from '@/lib/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { generateReport, OpenAIError } from '@/modules/interview-lens/lib/openai'
import { buildReportSystemPrompt, buildReportUserPrompt } from '@/modules/interview-lens/lib/prompts'
import { registry } from '@/lib/openapi/registry'
import { DEFAULT_SECURITY, ErrorResponseSchema, InternalServerErrorResponse } from '@/lib/openapi/common'

registry.registerPath({
  method: 'get',
  path: '/api/modules/interview-lens/submissions/{id}/report',
  operationId: 'getInterviewLensReport',
  summary: 'Get the generated report for a submission',
  tags: ['interview-lens'],
  security: DEFAULT_SECURITY,
  responses: {
    200: { description: 'Report', content: { 'application/json': { schema: { type: 'object' } } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    500: InternalServerErrorResponse,
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/modules/interview-lens/submissions/{id}/report',
  operationId: 'generateInterviewLensReport',
  summary: 'Generate a hire/no-hire report for a submission',
  tags: ['interview-lens'],
  security: DEFAULT_SECURITY,
  responses: {
    200: { description: 'Generated report', content: { 'application/json': { schema: { type: 'object' } } } },
    400: { description: 'Submission not in valid state', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    502: { description: 'AI generation failed', content: { 'application/json': { schema: ErrorResponseSchema } } },
    500: InternalServerErrorResponse,
  },
})

const uuidParam = z.string().uuid()

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (!uuidParam.safeParse(id).success) return createErrorResponse('Invalid id', 400)
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

    const rows = await withRLS((db) =>
      db.select().from(interviewLensReports)
        .where(and(eq(interviewLensReports.submissionId, id), eq(interviewLensReports.userId, user.id)))
        .limit(1)
    )
    if (rows.length === 0) return createErrorResponse('Not found', 404)
    return NextResponse.json({ report: toSnakeCase(rows[0]) })
  } catch (err) {
    console.error('GET report error:', err instanceof Error ? err.message : err)
    return createErrorResponse('Internal server error', 500)
  }
}

export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (!uuidParam.safeParse(id).success) return createErrorResponse('Invalid id', 400)
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

    // Load submission
    const subs = await withRLS((db) =>
      db.select().from(interviewLensSubmissions)
        .where(and(eq(interviewLensSubmissions.id, id), eq(interviewLensSubmissions.userId, user.id)))
        .limit(1)
    )
    if (subs.length === 0) return createErrorResponse('Not found', 404)
    const submission = subs[0]
    if (submission.status !== 'ready' && submission.status !== 'interviewed') {
      return createErrorResponse('Submission must be in ready or interviewed state to generate a report', 400)
    }

    // Load role, brief, questions in parallel
    const [roles, briefs, questions] = await Promise.all([
      withRLS((db) =>
        db.select().from(interviewLensRoles).where(and(eq(interviewLensRoles.id, submission.roleId), eq(interviewLensRoles.userId, user.id))).limit(1)
      ),
      withRLS((db) =>
        db.select().from(interviewLensBriefs)
          .where(and(eq(interviewLensBriefs.submissionId, id), eq(interviewLensBriefs.userId, user.id)))
          .limit(1)
      ),
      withRLS((db) =>
        db.select().from(interviewLensQuestions)
          .where(and(eq(interviewLensQuestions.submissionId, id), eq(interviewLensQuestions.userId, user.id)))
          .orderBy(asc(interviewLensQuestions.sortOrder))
      ),
    ])

    if (briefs.length === 0) return createErrorResponse('Brief must be generated before creating a report', 400)
    const role = roles[0]
    const brief = briefs[0]

    const questionData = questions.map((q) => ({
      tier: q.tier,
      prompt: q.prompt,
      notes: q.interviewerNotes,
      score: q.score,
      skipped: q.skipped,
    }))

    const reportOutput = await generateReport({
      systemPrompt: buildReportSystemPrompt(),
      userPrompt: buildReportUserPrompt({
        candidateName: submission.candidateName,
        roleTitle: role?.title ?? 'Unknown Role',
        roleSeniority: role?.seniority ?? null,
        briefSummary: brief.summaryMd,
        questions: questionData,
      }),
    })

    // Upsert report
    const upserted = await withRLS((db) =>
      db.insert(interviewLensReports).values({
        userId: user.id,
        submissionId: id,
        reportMd: reportOutput.report_md,
        recommendationMd: reportOutput.recommendation_md,
        hireScore: reportOutput.hire_score,
      })
      .onConflictDoUpdate({
        target: interviewLensReports.submissionId,
        set: {
          reportMd: reportOutput.report_md,
          recommendationMd: reportOutput.recommendation_md,
          hireScore: reportOutput.hire_score,
          generatedAt: new Date().toISOString(),
        },
      })
      .returning()
    )

    // Mark submission as interviewed
    await withRLS((db) =>
      db.update(interviewLensSubmissions)
        .set({ status: 'interviewed' })
        .where(and(eq(interviewLensSubmissions.id, id), eq(interviewLensSubmissions.userId, user.id)))
    )

    return NextResponse.json({ report: toSnakeCase(upserted[0]) })
  } catch (err) {
    if (err instanceof OpenAIError) {
      return createErrorResponse(`AI error: ${err.message}`, 502)
    }
    console.error('POST report error:', err instanceof Error ? err.message : err)
    return createErrorResponse('Internal server error', 500)
  }
}
