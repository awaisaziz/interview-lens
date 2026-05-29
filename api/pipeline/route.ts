import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { createErrorResponse } from '@/lib/api-helpers'
import { interviewLensRoles, interviewLensSubmissions, interviewLensQuestions } from '@/lib/db/schema'
import { and, avg, eq, inArray, desc } from 'drizzle-orm'
import { registry } from '@/lib/openapi/registry'
import { DEFAULT_SECURITY, ErrorResponseSchema, InternalServerErrorResponse } from '@/lib/openapi/common'

registry.registerPath({
  method: 'get',
  path: '/api/modules/interview-lens/pipeline',
  operationId: 'getInterviewLensPipeline',
  summary: 'Get the hiring pipeline grouped by role with avg scores',
  tags: ['interview-lens'],
  security: DEFAULT_SECURITY,
  responses: {
    200: { description: 'Pipeline data', content: { 'application/json': { schema: { type: 'object' } } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    500: InternalServerErrorResponse,
  },
})

export async function GET() {
  try {
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

    // Pull roles first, then filter submissions by those role IDs in SQL.
    const roles = await withRLS((db) =>
      db.select().from(interviewLensRoles)
        .where(eq(interviewLensRoles.userId, user.id))
        .orderBy(desc(interviewLensRoles.createdAt))
        .limit(200)
    )

    const roleIds = roles.map((r) => r.id)
    if (roleIds.length === 0) return NextResponse.json({ pipeline: [] })

    // This is a dashboard-widget rollup, not a full list view. We cap at the
    // 500 most-recent submissions across all roles to keep the query cheap;
    // the dedicated /interview-lens list page (paginated) is the source of
    // truth for users who exceed this ceiling.
    const subs = await withRLS((db) =>
      db.select().from(interviewLensSubmissions)
        .where(and(inArray(interviewLensSubmissions.roleId, roleIds), eq(interviewLensSubmissions.userId, user.id)))
        .orderBy(desc(interviewLensSubmissions.createdAt))
        .limit(500)
    )

    if (subs.length === 0) return NextResponse.json({ pipeline: [] })

    const scores = await withRLS((db) =>
      db.select({
        submissionId: interviewLensQuestions.submissionId,
        avgScore: avg(interviewLensQuestions.score).as('avg_score'),
      })
      .from(interviewLensQuestions)
      .where(and(eq(interviewLensQuestions.userId, user.id), inArray(interviewLensQuestions.submissionId, subs.map((s) => s.id))))
      .groupBy(interviewLensQuestions.submissionId)
    )

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
