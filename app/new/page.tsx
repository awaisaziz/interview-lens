'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, Microscope, AlertCircle, Sparkles, FileText } from 'lucide-react'
import { useRoles, useCreateSubmission, useAnalyzeSubmission } from '../../hooks/use-interview-lens'
import { useToast } from '@/hooks/use-toast'

type Phase = 'idle' | 'ingesting' | 'analyzing'

export default function NewSubmissionPage() {
  const { data: roles = [], isLoading: rolesLoading, isError: rolesError } = useRoles()
  const create = useCreateSubmission()
  const analyze = useAnalyzeSubmission()
  const { toast } = useToast()
  const router = useRouter()

  const [roleId, setRoleId] = useState<string>('')
  const [candidateName, setCandidateName] = useState('')
  const [pasted, setPasted] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [tab, setTab] = useState<'pasted_code' | 'github_url'>('pasted_code')
  const [err, setErr] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')

  const isBusy = phase !== 'idle'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!roleId || !candidateName.trim()) {
      setErr('Pick a role and enter a candidate name.')
      return
    }
    const sourceType = tab
    if (sourceType === 'pasted_code' && !pasted.trim()) {
      setErr('Paste the candidate\'s README/code, or switch to the GitHub URL tab.')
      return
    }
    if (sourceType === 'github_url' && !githubUrl.trim()) {
      setErr('Enter a public GitHub URL, or switch to the Paste tab.')
      return
    }

    setPhase('ingesting')
    create.mutate(
      {
        role_id: roleId,
        candidate_name: candidateName.trim(),
        source_type: sourceType,
        source_ref: sourceType === 'github_url' ? githubUrl.trim() : null,
        pasted_content: sourceType === 'pasted_code' ? pasted : null,
      },
      {
        onSuccess: ({ submission, partial, note }) => {
          if (partial && note) toast({ variant: 'destructive', title: 'Partial ingest', description: note })
          setPhase('analyzing')
          analyze.mutate(submission.id, {
            onSuccess: () => { router.push(`/interview-lens/${submission.id}`) },
            onError: (e) => {
              // Analysis failed — still navigate so user can retry from the detail page
              toast({ variant: 'destructive', title: 'Analysis failed', description: e.message })
              router.push(`/interview-lens/${submission.id}`)
            },
          })
        },
        onError: (e) => { setPhase('idle'); setErr(e.message) },
      },
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-medium flex items-center gap-2"><Microscope className="w-6 h-6 text-blue-600" />New submission</h1>
        <p className="text-sm text-muted-foreground mt-1">Submit a candidate's take-home. Pasted code is the most reliable path; the GitHub URL is best-effort and falls back to paste.</p>
      </div>

      {rolesLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading roles…</div>
      ) : rolesError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load roles. Please refresh.</AlertDescription>
        </Alert>
      ) : roles.length === 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No roles yet</AlertTitle>
          <AlertDescription>Add a role in Settings → Interview Lens before submitting candidates.</AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Candidate &amp; role</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="candidate">Candidate name</Label>
                  <Input id="candidate" value={candidateName} onChange={(e) => { setCandidateName(e.target.value); setErr(null) }} placeholder="Jane Doe" required maxLength={200} disabled={isBusy} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="role-select">Role</Label>
                  <Select value={roleId} onValueChange={(v) => { setRoleId(v); setErr(null) }} disabled={isBusy}>
                    <SelectTrigger id="role-select"><SelectValue placeholder="Select role…" /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}{r.seniority ? ` · ${r.seniority}` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Source</CardTitle>
              <CardDescription>Pasted code is fastest and most reliable.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={(v) => { setTab(v as 'pasted_code' | 'github_url'); setErr(null) }}>
                <TabsList>
                  <TabsTrigger value="pasted_code">Paste code (primary)</TabsTrigger>
                  <TabsTrigger value="github_url">GitHub URL</TabsTrigger>
                </TabsList>
                <TabsContent value="pasted_code" className="space-y-2">
                  <p className="text-xs text-muted-foreground">Paste the README plus the most representative source files. Separate files with a line like <code className="font-mono">--- src/app.ts ---</code>.</p>
                  <Textarea
                    value={pasted}
                    onChange={(e) => { setPasted(e.target.value); setErr(null) }}
                    placeholder={'--- README.md ---\n# My project\n...\n\n--- src/app.ts ---\nexport function ...'}
                    rows={16}
                    className="font-mono text-xs"
                    disabled={isBusy}
                  />
                </TabsContent>
                <TabsContent value="github_url" className="space-y-2">
                  <Input
                    value={githubUrl}
                    onChange={(e) => { setGithubUrl(e.target.value); setErr(null) }}
                    placeholder="https://github.com/owner/repo"
                    type="url"
                    disabled={isBusy}
                  />
                  <p className="text-xs text-muted-foreground">Public repos only (unauthenticated, 60 req/hr ceiling). If GitHub fails, the form will tell you to paste instead.</p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {phase === 'analyzing' && (
            <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <AlertTitle className="text-blue-900 dark:text-blue-100">Generating brief…</AlertTitle>
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                The AI is analysing the submission and building your interview brief. This usually takes 15–30 seconds.
              </AlertDescription>
            </Alert>
          )}

          {err && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={isBusy} onClick={() => router.push('/interview-lens')}>Cancel</Button>
            <Button type="submit" disabled={isBusy}>
              {phase === 'ingesting' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ingesting…</>
                : phase === 'analyzing' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analysing…</>
                : 'Create submission'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
