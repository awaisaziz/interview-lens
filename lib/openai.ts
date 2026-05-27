// Minimal OpenAI client — uses raw fetch so we don't add a new npm dep.
// Calls Chat Completions with Structured Outputs (json_schema, strict:true).

import { briefJsonSchema, briefOutputSchema, type BriefOutput } from './validation'

const DEFAULT_MODEL = 'gpt-4o-2024-08-06'

export class OpenAIError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

export async function generateBrief(args: {
  systemPrompt: string
  userPrompt: string
  model?: string
}): Promise<{ output: BriefOutput; raw: unknown }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new OpenAIError('OPENAI_API_KEY is not set in the server environment (.env.local).')
  }

  const body = {
    model: args.model ?? DEFAULT_MODEL,
    messages: [
      { role: 'system', content: args.systemPrompt },
      { role: 'user', content: args.userPrompt },
    ],
    temperature: 0.2,
    response_format: { type: 'json_schema', json_schema: briefJsonSchema },
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new OpenAIError(`OpenAI ${res.status}: ${text.slice(0, 500)}`, res.status)
  }

  let payload: any
  try {
    payload = JSON.parse(text)
  } catch {
    throw new OpenAIError('OpenAI returned non-JSON response.')
  }

  const choice = payload.choices?.[0]
  if (choice?.message?.refusal) {
    throw new OpenAIError(`Model refused: ${choice.message.refusal}`)
  }
  const content = choice?.message?.content
  if (typeof content !== 'string') {
    throw new OpenAIError('OpenAI response missing message.content.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new OpenAIError('Model output was not valid JSON despite structured-output request.')
  }

  // Defense in depth: re-validate against our Zod schema before persisting.
  const validation = briefOutputSchema.safeParse(parsed)
  if (!validation.success) {
    throw new OpenAIError(`Model output failed schema validation: ${validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
  }

  return { output: validation.data, raw: parsed }
}
