import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { createErrorResponse } from '@/lib/api-helpers'
import { interviewLensReports, interviewLensSubmissions, interviewLensRoles } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { registry } from '@/lib/openapi/registry'
import { DEFAULT_SECURITY, ErrorResponseSchema, InternalServerErrorResponse } from '@/lib/openapi/common'

registry.registerPath({
  method: 'get',
  path: '/api/modules/interview-lens/reports',
  operationId: 'listInterviewLensReports',
  summary: 'List all reports, optionally filtered by role_id',
  tags: ['interview-lens'],
  security: DEFAULT_SECURITY,
  responses: {
    200: { description: 'List of reports', content: { 'application/json': { schema: { type: 'object' } } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    500: InternalServerErrorResponse,
  },
})

const uuidParam = z.string().uuid()

export async function GET(request: NextRequest) {
  try {
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

    const roleId = request.nextUrl.searchParams.get('role_id')
    if (roleId && !uuidParam.safeParse(roleId).success) return createErrorResponse('Invalid role_id', 400)
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 100, 1), 500)
    const offset = Math.max(Number(request.nextUrl.searchParams.get('offset')) || 0, 0)

    const rows = await withRLS((db) =>
      db.select({
        id: interviewLensReports.id,
        submissionId: interviewLensReports.submissionId,
        hireScore: interviewLensReports.hireScore,
        generatedAt: interviewLensReports.generatedAt,
        candidateName: interviewLensSubmissions.candidateName,
        roleId: interviewLensSubmissions.roleId,
        roleTitle: interviewLensRoles.title,
      })
      .from(interviewLensReports)
      .innerJoin(interviewLensSubmissions, eq(interviewLensReports.submissionId, interviewLensSubmissions.id))
      .innerJoin(interviewLensRoles, eq(interviewLensSubmissions.roleId, interviewLensRoles.id))
      .where(
        and(
          eq(interviewLensReports.userId, user.id),
          eq(interviewLensSubmissions.userId, user.id),
          eq(interviewLensRoles.userId, user.id),
          roleId ? eq(interviewLensSubmissions.roleId, roleId) : undefined,
        )
      )
      .orderBy(desc(interviewLensReports.generatedAt))
      .limit(limit)
      .offset(offset)
    )

    const reports = rows.map((r) => ({
      id: r.id,
      submission_id: r.submissionId,
      candidate_name: r.candidateName,
      role_id: r.roleId,
      role_title: r.roleTitle,
      hire_score: r.hireScore,
      generated_at: r.generatedAt,
    }))

    return NextResponse.json({ reports })
  } catch (err) {
    console.error('GET reports error:', err instanceof Error ? err.message : err)
    return createErrorResponse('Internal server error', 500)
  }
}
