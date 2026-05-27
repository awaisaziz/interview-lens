import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { validateRequestBody, createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { createRoleSchema } from '@/modules/interview-lens/lib/validation'
import { interviewLensRoles } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

export async function GET() {
  try {
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)
    const rows = await withRLS((db) =>
      db.select().from(interviewLensRoles).where(eq(interviewLensRoles.userId, user.id)).orderBy(desc(interviewLensRoles.createdAt))
    )
    return NextResponse.json({ roles: toSnakeCase(rows) })
  } catch (err) {
    console.error('GET /api/modules/interview-lens/roles error:', err instanceof Error ? err.message : err)
    return createErrorResponse('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const validation = await validateRequestBody(request, createRoleSchema)
    if (!validation.success) return validation.response
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)
    const rows = await withRLS((db) =>
      db.insert(interviewLensRoles).values({
        userId: user.id,
        title: validation.data.title,
        seniority: validation.data.seniority ?? null,
        focusNotes: validation.data.focus_notes ?? null,
      }).returning()
    )
    return NextResponse.json({ role: toSnakeCase(rows[0]) }, { status: 201 })
  } catch (err) {
    console.error('POST /api/modules/interview-lens/roles error:', err instanceof Error ? err.message : err)
    return createErrorResponse('Internal server error', 500)
  }
}
