import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { validateRequestBody, createErrorResponse } from '@/lib/api-helpers'
import { settingsSchema } from '@/modules/interview-lens/lib/validation'
import { moduleSettings } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { registry } from '@/lib/openapi/registry'
import { DEFAULT_SECURITY, ErrorResponseSchema, InternalServerErrorResponse } from '@/lib/openapi/common'

registry.registerPath({
  method: 'get',
  path: '/api/modules/interview-lens/settings',
  operationId: 'getInterviewLensSettings',
  summary: 'Get Interview Lens settings for the current user',
  tags: ['interview-lens'],
  security: DEFAULT_SECURITY,
  responses: {
    200: { description: 'Settings object', content: { 'application/json': { schema: { type: 'object' } } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    500: InternalServerErrorResponse,
  },
})

registry.registerPath({
  method: 'put',
  path: '/api/modules/interview-lens/settings',
  operationId: 'updateInterviewLensSettings',
  summary: 'Update Interview Lens settings',
  tags: ['interview-lens'],
  security: DEFAULT_SECURITY,
  request: { body: { content: { 'application/json': { schema: settingsSchema } } } },
  responses: {
    200: { description: 'Settings saved', content: { 'application/json': { schema: { type: 'object' } } } },
    400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    500: InternalServerErrorResponse,
  },
})

const MODULE_ID = 'interview-lens'

export async function GET() {
  try {
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)
    const data = await withRLS((db) =>
      db.select({ settings: moduleSettings.settings })
        .from(moduleSettings)
        .where(and(eq(moduleSettings.moduleId, MODULE_ID), eq(moduleSettings.userId, user.id)))
        .limit(1)
    )
    return NextResponse.json(data[0]?.settings ?? {})
  } catch (err) {
    console.error('GET interview-lens settings error:', err instanceof Error ? err.message : err)
    return createErrorResponse('Internal server error', 500)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const validation = await validateRequestBody(request, settingsSchema)
    if (!validation.success) return validation.response
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)
    const patch = JSON.stringify(validation.data)
    await withRLS((db) =>
      db.insert(moduleSettings).values({
        userId: user.id,
        moduleId: MODULE_ID,
        settings: validation.data,
      }).onConflictDoUpdate({
        target: [moduleSettings.userId, moduleSettings.moduleId],
        set: {
          settings: sql`COALESCE(${moduleSettings.settings}, '{}'::jsonb) || ${patch}::jsonb`,
          updatedAt: sql`timezone('utc'::text, now())`,
        },
      })
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PUT interview-lens settings error:', err instanceof Error ? err.message : err)
    return createErrorResponse('Internal server error', 500)
  }
}
