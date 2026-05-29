import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { validateRequestBody, createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { createRoleSchema } from '@/modules/interview-lens/lib/validation'
import { interviewLensRoles } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { registry } from '@/lib/openapi/registry'
import { DEFAULT_SECURITY, ErrorResponseSchema, InternalServerErrorResponse } from '@/lib/openapi/common'

registry.registerPath({
  method: 'get',
  path: '/api/modules/interview-lens/roles',
  operationId: 'listInterviewLensRoles',
  summary: 'List interview roles for the current user',
  tags: ['interview-lens'],
  security: DEFAULT_SECURITY,
  responses: {
    200: { description: 'List of roles', content: { 'application/json': { schema: { type: 'object', properties: { roles: { type: 'array' } } } } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    500: InternalServerErrorResponse,
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/modules/interview-lens/roles',
  operationId: 'createInterviewLensRole',
  summary: 'Create a new interview role',
  tags: ['interview-lens'],
  security: DEFAULT_SECURITY,
  request: { body: { content: { 'application/json': { schema: createRoleSchema } } } },
  responses: {
    201: { description: 'Created role', content: { 'application/json': { schema: { type: 'object' } } } },
    400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    500: InternalServerErrorResponse,
  },
})

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
