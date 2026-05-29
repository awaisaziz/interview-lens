'use client'

import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, Printer, RefreshCw, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SafeMarkdown } from '../../../components/safe-markdown'
import { useReport, useGenerateReport, useSubmission } from '../../../hooks/use-interview-lens'

function hireScoreColor(score: number) {
  if (score >= 70) return 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200'
  if (score >= 40) return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
  return 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
}

function hireScoreLabel(score: number) {
  if (score >= 70) return 'Strong hire'
  if (score >= 50) return 'Lean hire'
  if (score >= 30) return 'Lean no-hire'
  return 'No hire'
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: detail, isLoading: detailLoading } = useSubmission(id)
  const { data: report, isLoading: reportLoading, isError } = useReport(id)
  const generateReport = useGenerateReport(id)

  const isLoading = detailLoading || reportLoading

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 print:p-0 print:max-w-none">
      <div className="flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.push('/interview-lens/reports')}>
          <ArrowLeft className="w-4 h-4 mr-1" />All Reports
        </Button>
        <Button variant="ghost" size="sm" onClick={() => router.push('/interview-lens')}>
          Dashboard
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />Export as PDF
        </Button>
        {report && (
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => generateReport.mutate(undefined)} disabled={generateReport.isPending}>
            {generateReport.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Re-generate
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />Loading report…
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load report. It may not have been generated yet.</AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && !report && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-3">
            <p>No report found for this submission.</p>
            <Button onClick={() => router.push(`/interview-lens/${id}`)}>Go to interview</Button>
          </CardContent>
        </Card>
      )}

      {report && detail && (
        <>
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-medium">{detail.submission.candidate_name}</h1>
              <Badge variant="secondary" className={hireScoreColor(report.hire_score)}>
                {report.hire_score}/100 — {hireScoreLabel(report.hire_score)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {detail.role?.title}{detail.role?.seniority ? ` · ${detail.role.seniority}` : ''} · Report generated {new Date(report.generated_at).toLocaleString()}
            </p>
          </div>

          {/* Recommendation */}
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader><CardTitle className="text-base">AI Recommendation</CardTitle></CardHeader>
            <CardContent>
              <SafeMarkdown>{report.recommendation_md}</SafeMarkdown>
            </CardContent>
          </Card>

          {/* Full report */}
          <Card>
            <CardHeader><CardTitle className="text-base">Full Report</CardTitle></CardHeader>
            <CardContent>
              <SafeMarkdown>{report.report_md}</SafeMarkdown>
            </CardContent>
          </Card>
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
