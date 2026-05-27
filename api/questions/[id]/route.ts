import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { validateRequestBody, createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { updateQuestionSchema } from '@/modules/interview-lens/lib/validation'
import { interviewLensQuestions } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const uuidParam = z.string().uuid()

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (!uuidParam.safeParse(id).success) return createErrorResponse('Invalid id', 400)
    const validation = await validateRequestBody(request, updateQuestionSchema)
    if (!validation.success) return validation.response
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

    const patch: Record<string, unknown> = {}
    if (validation.data.interviewer_notes !== undefined) patch.interviewerNotes = validation.data.interviewer_notes
    if (validation.data.score !== undefined) patch.score = validation.data.score
    if (Object.keys(patch).length === 0) return createErrorResponse('No fields to update', 400)

    const rows = await withRLS((db) =>
      db.update(interviewLensQuestions).set(patch)
        .where(and(eq(interviewLensQuestions.id, id), eq(interviewLensQuestions.userId, user.id)))
        .returning()
    )
    if (rows.length === 0) return createErrorResponse('Not found', 404)
    return NextResponse.json({ question: toSnakeCase(rows[0]) })
  } catch (err) {
    console.error('PATCH question error:', err instanceof Error ? err.message : err)
    return createErrorResponse('Internal server error', 500)
  }
}
