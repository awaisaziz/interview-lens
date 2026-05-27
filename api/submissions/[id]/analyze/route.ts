import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { createErrorResponse } from '@/lib/api-helpers'
import { interviewLensSubmissions, interviewLensBriefs, interviewLensQuestions, interviewLensRoles } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { generateBrief, OpenAIError } from '@/modules/interview-lens/lib/openai'
import { buildSystemPrompt, buildUserPrompt } from '@/modules/interview-lens/lib/prompts'

const uuidParam = z.string().uuid()

export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!uuidParam.safeParse(id).success) return createErrorResponse('Invalid id', 400)

  const { user, withRLS } = await getAuthenticatedUser()
  if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

  // Load submission + role.
  const subs = await withRLS((db) =>
    db.select().from(interviewLensSubmissions)
      .where(and(eq(interviewLensSubmissions.id, id), eq(interviewLensSubmissions.userId, user.id)))
      .limit(1)
  )
  if (subs.length === 0) return createErrorResponse('Submission not found', 404)
  const submission = subs[0]
  if (!submission.repoDigest) {
    return createErrorResponse('Submission has no digest to analyze', 422)
  }

  const roles = await withRLS((db) =>
    db.select().from(interviewLensRoles).where(eq(interviewLensRoles.id, submission.roleId)).limit(1)
  )
  const role = roles[0] ?? null

  // Mark analyzing, clear prior error.
  await withRLS((db) =>
    db.update(interviewLensSubmissions)
      .set({ status: 'analyzing', errorMessage: null })
      .where(eq(interviewLensSubmissions.id, id))
  )

  try {
    const { output, raw } = await generateBrief({
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt({
        focusNotes: role?.focusNotes ?? null,
        candidateName: submission.candidateName,
        digest: submission.repoDigest,
      }),
    })

    // Persist brief + questions, then flip status. Drizzle's pool doesn't
    // expose nested transactions here cleanly across withRLS, so we replace
    // any existing brief/questions (idempotent re-analyze) instead.
    await withRLS(async (db) => {
      await db.delete(interviewLensQuestions).where(eq(interviewLensQuestions.submissionId, id))
      await db.delete(interviewLensBriefs).where(eq(interviewLensBriefs.submissionId, id))
      await db.insert(interviewLensBriefs).values({
        userId: user.id,
        submissionId: id,
        summaryMd: output.summary_md,
        stackJson: output.stack,
        architectureMd: output.architecture_md,
        signalReportMd: output.signal_report_md,
        rawModelOutput: raw as any,
      })
      if (output.questions.length > 0) {
        await db.insert(interviewLensQuestions).values(
          output.questions.map((q, i) => ({
            userId: user.id,
            submissionId: id,
            tier: q.tier,
            prompt: q.prompt,
            anchorFile: q.anchor_file,
            strongAnswerMd: q.strong_answer_md,
            sortOrder: i,
          })),
        )
      }
      await db.update(interviewLensSubmissions)
        .set({ status: 'ready', errorMessage: null })
        .where(eq(interviewLensSubmissions.id, id))
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof OpenAIError
      ? err.message
      : err instanceof Error ? err.message : 'Analysis failed'
    console.error('Analyze error:', message)
    await withRLS((db) =>
      db.update(interviewLensSubmissions)
        .set({ status: 'failed', errorMessage: message.slice(0, 1000) })
        .where(eq(interviewLensSubmissions.id, id))
    )
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
