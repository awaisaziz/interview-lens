'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, Sparkles, RefreshCw, AlertCircle, ShieldAlert, ClipboardList, FileText } from 'lucide-react'
import type { SubmissionDetail as DetailType, Question, Tier } from '../types'
import { SafeMarkdown } from './safe-markdown'
import { QuestionCard } from './question-card'
import { useAnalyzeSubmission, useGenerateReport } from '../hooks/use-interview-lens'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

const TIERS: Tier[] = ['easy', 'medium', 'hard']
const tierLabel: Record<Tier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

function statusBadge(status: string) {
  const color =
    status === 'ready' ? 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200'
    : status === 'analyzing' ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200'
    : status === 'failed' ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
    : status === 'interviewed' ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200'
    : 'bg-muted text-muted-foreground'
  return <Badge variant="secondary" className={color}>{status}</Badge>
}

export function SubmissionDetailView({ detail }: { detail: DetailType }) {
  const { submission, brief, questions, role, report } = detail
  const analyze = useAnalyzeSubmission()
  const generateReport = useGenerateReport(submission.id)
  const { toast } = useToast()
  const router = useRouter()
  const [tierFilter, setTierFilter] = useState<Tier | 'all'>('all')

  const visibleQuestions = questions.filter((q) => tierFilter === 'all' || q.tier === tierFilter)
  const groupedByTier: Record<Tier, Question[]> = {
    easy: visibleQuestions.filter((q) => q.tier === 'easy'),
    medium: visibleQuestions.filter((q) => q.tier === 'medium'),
    hard: visibleQuestions.filter((q) => q.tier === 'hard'),
  }

  const runAnalyze = () => {
    analyze.mutate(submission.id, {
      onError: (err) => toast({ variant: 'destructive', title: 'Analysis failed', description: err.message }),
    })
  }

  const runGenerateReport = () => {
    generateReport.mutate(undefined, {
      onSuccess: (r) => {
        router.push(`/interview-lens/reports/${submission.id}`)
      },
      onError: (err) => toast({ variant: 'destructive', title: 'Report generation failed', description: err.message }),
    })
  }

  const canSubmit = (submission.status === 'ready' || submission.status === 'interviewed') && !!brief

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-medium">{submission.candidate_name}</h1>
            {statusBadge(submission.status)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {role?.title}{role?.seniority ? ` · ${role.seniority}` : ''} · {submission.source_type === 'github_url' ? 'GitHub' : 'Pasted'}
            {submission.source_ref && <> · <a href={submission.source_ref} target="_blank" rel="noopener noreferrer" className="underline">{submission.source_ref}</a></>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {submission.status !== 'analyzing' && submission.status !== 'failed' && (
            <Button variant="outline" onClick={runAnalyze} disabled={analyze.isPending}>
              {analyze.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />Analyzing…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />{brief ? 'Re-generate brief' : 'Generate brief'}</>
              )}
            </Button>
          )}
          {submission.status === 'failed' && (
            <Button onClick={runAnalyze} disabled={analyze.isPending} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />Retry
            </Button>
          )}
          {canSubmit && (
            report ? (
              <Button onClick={() => router.push(`/interview-lens/reports/${submission.id}`)}>
                <FileText className="w-4 h-4 mr-2" />View Report
              </Button>
            ) : (
              <Button onClick={runGenerateReport} disabled={generateReport.isPending}>
                {generateReport.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />Generating report…</>
                ) : (
                  <><ClipboardList className="w-4 h-4 mr-2" />Submit Interview &amp; Generate Report</>
                )}
              </Button>
            )
          )}
          {canSubmit && report && (
            <Button variant="ghost" size="sm" onClick={runGenerateReport} disabled={generateReport.isPending} className="text-muted-foreground text-xs">
              {generateReport.isPending ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-3 h-3 mr-1" aria-hidden="true" />}
              Re-generate
            </Button>
          )}
        </div>
      </div>

      {submission.status === 'failed' && submission.error_message && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Last analysis failed</AlertTitle>
          <AlertDescription className="font-mono text-xs whitespace-pre-wrap break-all">{submission.error_message}</AlertDescription>
        </Alert>
      )}

      {submission.status === 'analyzing' && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <AlertTitle>Analyzing…</AlertTitle>
          <AlertDescription>Calling OpenAI with the persisted digest. This usually takes 10–30 seconds.</AlertDescription>
        </Alert>
      )}

      {!brief && submission.status === 'pending' && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Sparkles className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No brief yet. Click <strong>Generate brief</strong> to run the analysis.</p>
          </CardContent>
        </Card>
      )}

      {brief && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: brief */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
              <CardContent><SafeMarkdown>{brief.summary_md}</SafeMarkdown></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Stack</CardTitle></CardHeader>
              <CardContent>
                {brief.stack_json.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stack detected.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {brief.stack_json.map((s, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <Badge variant="outline" className="font-mono">{s.name}</Badge>
                        <span className="text-muted-foreground">{s.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Architecture</CardTitle></CardHeader>
              <CardContent><SafeMarkdown>{brief.architecture_md}</SafeMarkdown></CardContent>
            </Card>
            <Card className="border-amber-300 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Honest take on the work
                </CardTitle>
                <CardDescription>Strengths worth probing, weaknesses to push on, and anything that looks coached or AI-generated.</CardDescription>
              </CardHeader>
              <CardContent><SafeMarkdown>{brief.signal_report_md}</SafeMarkdown></CardContent>
            </Card>
          </div>

          {/* Right: questions + per-question notes */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <Button size="sm" variant={tierFilter === 'all' ? 'default' : 'outline'} onClick={() => setTierFilter('all')}>All ({questions.length})</Button>
              {TIERS.map((t) => {
                const n = questions.filter((q) => q.tier === t).length
                return (
                  <Button key={t} size="sm" variant={tierFilter === t ? 'default' : 'outline'} onClick={() => setTierFilter(t)}>
                    {tierLabel[t]} ({n})
                  </Button>
                )
              })}
            </div>
            {TIERS.map((t) => {
              const items = groupedByTier[t]
              if (items.length === 0) return null
              return (
                <div key={t} className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{tierLabel[t]}</h3>
                  {items.map((q) => <QuestionCard key={q.id} question={q} submissionId={submission.id} />)}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
