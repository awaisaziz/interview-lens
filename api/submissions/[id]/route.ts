import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { interviewLensSubmissions, interviewLensBriefs, interviewLensQuestions, interviewLensRoles, interviewLensReports } from '@/lib/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { registry } from '@/lib/openapi/registry'
import { DEFAULT_SECURITY, ErrorResponseSchema, InternalServerErrorResponse } from '@/lib/openapi/common'

registry.registerPath({
  method: 'get',
  path: '/api/modules/interview-lens/submissions/{id}',
  operationId: 'getInterviewLensSubmission',
  summary: 'Get full submission detail including brief, questions, and report',
  tags: ['interview-lens'],
  security: DEFAULT_SECURITY,
  responses: {
    200: { description: 'Submission detail', content: { 'application/json': { schema: { type: 'object' } } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    500: InternalServerErrorResponse,
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/modules/interview-lens/submissions/{id}',
  operationId: 'deleteInterviewLensSubmission',
  summary: 'Delete a submission',
  tags: ['interview-lens'],
  security: DEFAULT_SECURITY,
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object' } } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
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

    const subs = await withRLS((db) =>
      db.select().from(interviewLensSubmissions)
        .where(and(eq(interviewLensSubmissions.id, id), eq(interviewLensSubmissions.userId, user.id)))
        .limit(1)
    )
    if (subs.length === 0) return createErrorResponse('Not found', 404)
    const submission = subs[0]

    const [role, briefs, questions, reports] = await Promise.all([
      withRLS((db) =>
        db.select().from(interviewLensRoles).where(and(eq(interviewLensRoles.id, submission.roleId), eq(interviewLensRoles.userId, user.id))).limit(1)
      ),
      withRLS((db) =>
        db.select({
          id: interviewLensBriefs.id,
          submissionId: interviewLensBriefs.submissionId,
          summaryMd: interviewLensBriefs.summaryMd,
          stackJson: interviewLensBriefs.stackJson,
          architectureMd: interviewLensBriefs.architectureMd,
          signalReportMd: interviewLensBriefs.signalReportMd,
          generatedAt: interviewLensBriefs.generatedAt,
        }).from(interviewLensBriefs)
          .where(and(eq(interviewLensBriefs.submissionId, id), eq(interviewLensBriefs.userId, user.id)))
          .limit(1)
      ),
      withRLS((db) =>
        db.select().from(interviewLensQuestions).where(and(eq(interviewLensQuestions.submissionId, id), eq(interviewLensQuestions.userId, user.id))).orderBy(asc(interviewLensQuestions.sortOrder))
      ),
      withRLS((db) =>
        db.select().from(interviewLensReports)
          .where(and(eq(interviewLensReports.submissionId, id), eq(interviewLensReports.userId, user.id)))
          .limit(1)
      ),
    ])

    return NextResponse.json({
      submission: toSnakeCase(submission),
      role: role[0] ? toSnakeCase(role[0]) : null,
      brief: briefs[0] ? toSnakeCase(briefs[0]) : null,
      questions: toSnakeCase(questions),
      report: reports[0] ? toSnakeCase(reports[0]) : null,
    })
  } catch (err) {
    console.error('GET submission detail error:', err instanceof Error ? err.message : err)
    return createErrorResponse('Internal server error', 500)
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (!uuidParam.safeParse(id).success) return createErrorResponse('Invalid id', 400)
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)
    await withRLS((db) =>
      db.delete(interviewLensSubmissions).where(and(eq(interviewLensSubmissions.id, id), eq(interviewLensSubmissions.userId, user.id)))
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE submission error:', err instanceof Error ? err.message : err)
    return createErrorResponse('Internal server error', 500)
  }
}
