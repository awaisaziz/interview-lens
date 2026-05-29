import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { validateRequestBody, createErrorResponse, toSnakeCase } from '@/lib/api-helpers'
import { createSubmissionSchema } from '@/modules/interview-lens/lib/validation'
import { buildDigest } from '@/modules/interview-lens/lib/digest'
import { interviewLensSubmissions, interviewLensRoles } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { registry } from '@/lib/openapi/registry'
import { DEFAULT_SECURITY, ErrorResponseSchema, InternalServerErrorResponse } from '@/lib/openapi/common'

registry.registerPath({
  method: 'get',
  path: '/api/modules/interview-lens/submissions',
  operationId: 'listInterviewLensSubmissions',
  summary: 'List submissions for the current user',
  tags: ['interview-lens'],
  security: DEFAULT_SECURITY,
  responses: {
    200: { description: 'List of submissions', content: { 'application/json': { schema: { type: 'object' } } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    500: InternalServerErrorResponse,
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/modules/interview-lens/submissions',
  operationId: 'createInterviewLensSubmission',
  summary: 'Create a new candidate submission',
  tags: ['interview-lens'],
  security: DEFAULT_SECURITY,
  request: { body: { content: { 'application/json': { schema: createSubmissionSchema } } } },
  responses: {
    201: { description: 'Created submission', content: { 'application/json': { schema: { type: 'object' } } } },
    400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    422: { description: 'Digest build failed', content: { 'application/json': { schema: ErrorResponseSchema } } },
    500: InternalServerErrorResponse,
  },
})

export async function GET() {
  try {
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)
    const rows = await withRLS((db) =>
      db.select().from(interviewLensSubmissions).where(eq(interviewLensSubmissions.userId, user.id)).orderBy(desc(interviewLensSubmissions.createdAt))
    )
    return NextResponse.json({ submissions: toSnakeCase(rows) })
  } catch (err) {
    console.error('GET submissions error:', err instanceof Error ? err.message : err)
    return createErrorResponse('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const validation = await validateRequestBody(request, createSubmissionSchema)
    if (!validation.success) return validation.response
    const { user, withRLS } = await getAuthenticatedUser()
    if (!user || !withRLS) return createErrorResponse('Unauthorized', 401)

    // Verify the role belongs to this user before we accept the submission.
    const role = await withRLS((db) =>
      db.select({ id: interviewLensRoles.id }).from(interviewLensRoles)
        .where(and(eq(interviewLensRoles.id, validation.data.role_id), eq(interviewLensRoles.userId, user.id)))
        .limit(1)
    )
    if (role.length === 0) return createErrorResponse('Role not found', 404)

    // Build and PERSIST the digest so re-analyze never refetches GitHub.
    const { digest, partial, note } = await buildDigest({
      sourceType: validation.data.source_type,
      sourceRef: validation.data.source_ref ?? null,
      pastedContent: validation.data.pasted_content ?? null,
    })

    if (!digest) {
      return NextResponse.json(
        { error: note ?? 'Could not build a digest from the provided source.' },
        { status: 422 },
      )
    }

    const rows = await withRLS((db) =>
      db.insert(interviewLensSubmissions).values({
        userId: user.id,
        roleId: validation.data.role_id,
        candidateName: validation.data.candidate_name,
        sourceType: validation.data.source_type,
        sourceRef: validation.data.source_ref ?? null,
        pastedContent: validation.data.source_type === 'pasted_code' ? (validation.data.pasted_content ?? null) : null,
        repoDigest: digest,
        status: 'pending',
      }).returning()
    )

    return NextResponse.json(
      { submission: toSnakeCase(rows[0]), partial, note: note ?? null },
      { status: 201 },
    )
  } catch (err) {
    console.error('POST submissions error:', err instanceof Error ? err.message : err)
    return createErrorResponse('Internal server error', 500)
  }
}
