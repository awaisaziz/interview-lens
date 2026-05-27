import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { createErrorResponse } from '@/lib/api-helpers'
import { interviewLensRoles, interviewLensSubmissions, interviewLensQuestions } from '@/lib/db/schema'
import { avg, eq, sql, desc } from 'drizzle-orm'

export async function GET() {
  try {
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

    // Pull roles + submissions, then compute average score per submission.
    const [roles, subs, scores] = await Promise.all([
      withRLS((db) =>
        db.select().from(interviewLensRoles)
          .where(eq(interviewLensRoles.userId, user.id))
          .orderBy(desc(interviewLensRoles.createdAt))
      ),
      withRLS((db) =>
        db.select().from(interviewLensSubmissions)
          .where(eq(interviewLensSubmissions.userId, user.id))
          .orderBy(desc(interviewLensSubmissions.createdAt))
      ),
      withRLS((db) =>
        db.select({
          submissionId: interviewLensQuestions.submissionId,
          avgScore: avg(interviewLensQuestions.score).as('avg_score'),
        })
        .from(interviewLensQuestions)
        .where(eq(interviewLensQuestions.userId, user.id))
        .groupBy(interviewLensQuestions.submissionId)
      ),
    ])

    const scoreMap = new Map(scores.map((s) => [s.submissionId, s.avgScore == null ? null : Number(s.avgScore)]))

    const pipeline = roles.map((r) => ({
      role_id: r.id,
      role_title: r.title,
      submissions: subs
        .filter((s) => s.roleId === r.id)
        .map((s) => ({
          id: s.id,
          candidate_name: s.candidateName,
          status: s.status,
          avg_score: scoreMap.get(s.id) ?? null,
        })),
    }))

    return NextResponse.json({ pipeline })
  } catch (err) {
    console.error('GET pipeline error:', err instanceof Error ? err.message : err)
    return createErrorResponse('Internal server error', 500)
  }
}
