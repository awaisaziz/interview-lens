'use client'

import { usePathname, useRouter } from 'next/navigation'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, Printer, RefreshCw, AlertCircle, CheckCircle2, XCircle, MinusCircle, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SafeMarkdown } from '../../../components/safe-markdown'
import { useReport, useGenerateReport, useDeleteReport, useSubmission } from '../../../hooks/use-interview-lens'
import { useToast } from '@/hooks/use-toast'
import type { Question, Tier, Report } from '../../../types'

const TIER_ORDER: Tier[] = ['easy', 'medium', 'hard']
const tierLabel: Record<Tier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const tierColor: Record<Tier, string> = {
  easy: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  hard: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
}

function ScoreIcon({ score }: { score: number | null }) {
  if (score == null) return <MinusCircle className="w-4 h-4 text-muted-foreground" />
  if (score >= 4) return <CheckCircle2 className="w-4 h-4 text-green-600" />
  if (score >= 3) return <MinusCircle className="w-4 h-4 text-amber-500" />
  return <XCircle className="w-4 h-4 text-red-500" />
}

function ScoreDots({ score, total = 5 }: { score: number | null; total?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full border ${
            score != null && i < score
              ? score >= 4 ? 'bg-green-500 border-green-500'
                : score >= 3 ? 'bg-amber-400 border-amber-400'
                : 'bg-red-400 border-red-400'
              : 'bg-muted border-muted-foreground/20'
          }`}
        />
      ))}
    </div>
  )
}

function HireScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  const label = score >= 70 ? 'Strong hire' : score >= 50 ? 'Lean hire' : score >= 30 ? 'Lean no-hire' : 'No hire'
  const badgeColor = score >= 70
    ? 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200'
    : score >= 40
    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
    : 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'

  const r = 52
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/30" />
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold tabular-nums">{score}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>
      <Badge variant="secondary" className={`text-sm px-3 py-1 ${badgeColor}`}>{label}</Badge>
    </div>
  )
}

function QuestionScoreRow({ q }: { q: Question }) {
  return (
    <div className={`flex items-start gap-3 py-2.5 border-b last:border-0 ${q.skipped ? 'opacity-50' : ''}`}>
      <ScoreIcon score={q.skipped ? null : q.score} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <Badge variant="outline" className={`text-xs ${tierColor[q.tier]}`}>{tierLabel[q.tier]}</Badge>
          {q.skipped && <span className="text-xs text-muted-foreground italic">skipped</span>}
          <ScoreDots score={q.skipped ? null : q.score} />
        </div>
        <p className="text-sm leading-snug line-clamp-2">{q.prompt}</p>
        {q.interviewer_notes && (
          <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">"{q.interviewer_notes}"</p>
        )}
      </div>
    </div>
  )
}

function scoreStats(questions: Question[]) {
  const scored = questions.filter((q) => !q.skipped && q.score != null)
  const skipped = questions.filter((q) => q.skipped).length
  const avg = scored.length > 0 ? scored.reduce((s, q) => s + (q.score ?? 0), 0) / scored.length : null
  const byTier = TIER_ORDER.map((t) => {
    const tq = scored.filter((q) => q.tier === t)
    return {
      tier: t,
      count: tq.length,
      avg: tq.length > 0 ? tq.reduce((s, q) => s + (q.score ?? 0), 0) / tq.length : null,
    }
  })
  return { scored: scored.length, skipped, total: questions.length, avg, byTier }
}

const uuidSchema = z.string().uuid()

export default function ReportPage() {
  const pathname = usePathname()
  const rawId = pathname?.split('/').at(-1) ?? ''
  const id = uuidSchema.safeParse(rawId).success ? rawId : ''
  const router = useRouter()
  const { data: detail, isLoading: detailLoading } = useSubmission(id)
  const { data: reportFromApi, isLoading: reportLoading, isError } = useReport(id)
  const generateReport = useGenerateReport(id)
  const deleteReport = useDeleteReport()
  const { toast } = useToast()

  const handleDelete = () => {
    if (!confirm('Delete this report? The interview answers and scores are kept — you can regenerate the report later.')) return
    deleteReport.mutate(id, {
      onSuccess: () => router.push('/interview-lens/reports'),
      onError: (e) => toast({ variant: 'destructive', title: 'Delete failed', description: e.message }),
    })
  }

  // Use report from direct API call; fall back to the one embedded in the submission detail
  const report: Report | null = reportFromApi ?? detail?.report ?? null
  const isLoading = detailLoading || reportLoading

  const questions = detail?.questions ?? []
  const stats = scoreStats(questions)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 print:p-0 print:max-w-none">
      {/* Toolbar */}
      <div className="flex items-center gap-2 print:hidden flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => router.push('/interview-lens/reports')}>
          <ArrowLeft className="w-4 h-4 mr-1" />All Reports
        </Button>
        <Button variant="ghost" size="sm" onClick={() => router.push(`/interview-lens/${id}`)}>
          Interview
        </Button>
        <div className="flex-1" />
        {report && (
          <Button
            variant="ghost" size="sm"
            className="text-muted-foreground text-xs"
            onClick={() => generateReport.mutate(undefined)}
            disabled={generateReport.isPending}
          >
            {generateReport.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" aria-hidden="true" /> : <RefreshCw className="w-3 h-3 mr-1" aria-hidden="true" />}
            Re-generate
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />Export as PDF
        </Button>
        {report && (
          <Button
            variant="ghost" size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={handleDelete}
            disabled={deleteReport.isPending}
          >
            {deleteReport.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" /> : <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />}
            Delete
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-20 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading report…
        </div>
      )}

      {!isLoading && isError && !report && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load report.</AlertDescription>
        </Alert>
      )}

      {!isLoading && !report && (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <p className="text-sm text-muted-foreground">No report generated yet for this submission.</p>
            <Button
              onClick={() => generateReport.mutate(undefined)}
              disabled={generateReport.isPending}
            >
              {generateReport.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />Generating…</> : 'Generate Report'}
            </Button>
          </CardContent>
        </Card>
      )}

      {report && detail && (
        <>
          {/* Page header */}
          <div>
            <h1 className="text-2xl font-medium">{detail.submission.candidate_name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {detail.role?.title}{detail.role?.seniority ? ` · ${detail.role.seniority}` : ''} · Report generated {new Date(report.generated_at).toLocaleString()}
            </p>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

            {/* LEFT — Score panel */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardContent className="pt-6 flex flex-col items-center gap-6">
                  <HireScoreRing score={report.hire_score} />

                  {/* Per-tier breakdown */}
                  <div className="w-full space-y-2">
                    {stats.byTier.map(({ tier, count, avg }) => (
                      <div key={tier} className="flex items-center gap-3">
                        <Badge variant="outline" className={`w-16 justify-center text-xs ${tierColor[tier]}`}>{tierLabel[tier]}</Badge>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: avg != null ? `${(avg / 5) * 100}%` : '0%',
                              backgroundColor: tier === 'easy' ? '#22c55e' : tier === 'medium' ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground w-12 text-right">
                          {avg != null ? `${avg.toFixed(1)}/5` : '—'} ({count})
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Stats row */}
                  <div className="w-full grid grid-cols-3 gap-2 text-center border-t pt-4">
                    <div>
                      <div className="text-2xl font-semibold">{stats.scored}</div>
                      <div className="text-xs text-muted-foreground">scored</div>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold">{stats.avg != null ? stats.avg.toFixed(1) : '—'}</div>
                      <div className="text-xs text-muted-foreground">avg / 5</div>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold">{stats.skipped}</div>
                      <div className="text-xs text-muted-foreground">skipped</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI recommendation */}
              <Card className="border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">AI Recommendation</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <SafeMarkdown>{report.recommendation_md}</SafeMarkdown>
                </CardContent>
              </Card>

              {/* Per-question scores */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Question Scores</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {questions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No questions recorded.</p>
                  ) : (
                    TIER_ORDER.map((t) => {
                      const tqs = questions.filter((q) => q.tier === t)
                      if (tqs.length === 0) return null
                      return (
                        <div key={t} className="mb-3 last:mb-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{tierLabel[t]}</p>
                          {tqs.map((q) => <QuestionScoreRow key={q.id} q={q} />)}
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RIGHT — Full report */}
            <div className="lg:col-span-3 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Full Assessment</CardTitle>
                </CardHeader>
                <CardContent>
                  <SafeMarkdown>{report.report_md}</SafeMarkdown>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:max-w-none { max-width: none !important; }
        }
      `}</style>
    </div>
  )
}
