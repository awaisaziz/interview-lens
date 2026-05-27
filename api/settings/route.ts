import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { validateRequestBody, createErrorResponse } from '@/lib/api-helpers'
import { settingsSchema } from '@/modules/interview-lens/lib/validation'
import { moduleSettings } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

const MODULE_ID = 'interview-lens'

export async function GET() {
  try {
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)
    const data = await withRLS((db) =>
      db.select({ settings: moduleSettings.settings })
        .from(moduleSettings)
        .where(eq(moduleSettings.moduleId, MODULE_ID))
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
