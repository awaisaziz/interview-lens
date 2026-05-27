'use client'

import { RoleManager } from './role-manager'

export function InterviewLensSettingsPanel() {
  const hasKey = typeof process !== 'undefined' && !!process.env.NEXT_PUBLIC_OPENAI_CONFIGURED
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Interview Lens</h3>
        <p className="text-sm text-muted-foreground">
          Set up the roles you hire for. Each submission picks a role; the role's focus notes shape what the brief emphasizes.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <p className="font-medium">OpenAI key</p>
        <p className="text-muted-foreground mt-1">
          The analysis pipeline calls OpenAI directly from the server using <code className="font-mono">OPENAI_API_KEY</code> in <code className="font-mono">.env.local</code>. There is no in-app key field — the secret never reaches the browser.
        </p>
      </div>

      <RoleManager />
    </div>
  )
}
