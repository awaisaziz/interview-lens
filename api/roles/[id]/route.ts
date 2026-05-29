import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { validateRequestBody, createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { updateRoleSchema } from '@/modules/interview-lens/lib/validation'
import { interviewLensRoles } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { registry } from '@/lib/openapi/registry'
import { DEFAULT_SECURITY, ErrorResponseSchema, InternalServerErrorResponse } from '@/lib/openapi/common'

registry.registerPath({
  method: 'patch',
  path: '/api/modules/interview-lens/roles/{id}',
  operationId: 'updateInterviewLensRole',
  summary: 'Update an interview role',
  tags: ['interview-lens'],
  security: DEFAULT_SECURITY,
  request: { body: { content: { 'application/json': { schema: updateRoleSchema } } } },
  responses: {
    200: { description: 'Updated role', content: { 'application/json': { schema: { type: 'object' } } } },
    400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    500: InternalServerErrorResponse,
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/modules/interview-lens/roles/{id}',
  operationId: 'deleteInterviewLensRole',
  summary: 'Delete an interview role',
  tags: ['interview-lens'],
  security: DEFAULT_SECURITY,
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object' } } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    500: InternalServerErrorResponse,
  },
})

const uuidParam = z.string().uuid()

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (!uuidParam.safeParse(id).success) return createErrorResponse('Invalid id', 400)
    const validation = await validateRequestBody(request, updateRoleSchema)
    if (!validation.success) return validation.response
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

    const patch: Record<string, unknown> = {}
    if (validation.data.title !== undefined) patch.title = validation.data.title
    if (validation.data.seniority !== undefined) patch.seniority = validation.data.seniority
    if (validation.data.focus_notes !== undefined) patch.focusNotes = validation.data.focus_notes

    const rows = await withRLS((db) =>
      db.update(interviewLensRoles).set(patch).where(and(eq(interviewLensRoles.id, id), eq(interviewLensRoles.userId, user.id))).returning()
    )
    if (rows.length === 0) return createErrorResponse('Not found', 404)
    return NextResponse.json({ role: toSnakeCase(rows[0]) })
  } catch (err) {
    console.error('PATCH role error:', err instanceof Error ? err.message : err)
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
      db.delete(interviewLensRoles).where(and(eq(interviewLensRoles.id, id), eq(interviewLensRoles.userId, user.id)))
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE role error:', err instanceof Error ? err.message : err)
    return createErrorResponse('Internal server error', 500)
  }
}
