import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { interviewLensSubmissions, interviewLensBriefs, interviewLensQuestions, interviewLensRoles } from '@/lib/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'

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

    const [role, briefs, questions] = await Promise.all([
      withRLS((db) =>
        db.select().from(interviewLensRoles).where(eq(interviewLensRoles.id, submission.roleId)).limit(1)
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
        }).from(interviewLensBriefs).where(eq(interviewLensBriefs.submissionId, id)).limit(1)
      ),
      withRLS((db) =>
        db.select().from(interviewLensQuestions).where(eq(interviewLensQuestions.submissionId, id)).orderBy(asc(interviewLensQuestions.sortOrder))
      ),
    ])

    return NextResponse.json({
      submission: toSnakeCase(submission),
      role: role[0] ? toSnakeCase(role[0]) : null,
      brief: briefs[0] ? toSnakeCase(briefs[0]) : null,
      questions: toSnakeCase(questions),
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
