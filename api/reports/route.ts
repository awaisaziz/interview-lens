import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { createErrorResponse } from '@/lib/api-helpers'
import { interviewLensReports, interviewLensSubmissions, interviewLensRoles } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

const uuidParam = z.string().uuid()

export async function GET(request: NextRequest) {
  try {
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

    const roleId = request.nextUrl.searchParams.get('role_id')
    if (roleId && !uuidParam.safeParse(roleId).success) return createErrorResponse('Invalid role_id', 400)

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
          roleId ? eq(interviewLensSubmissions.roleId, roleId) : undefined,
        )
      )
      .orderBy(desc(interviewLensReports.generatedAt))
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
