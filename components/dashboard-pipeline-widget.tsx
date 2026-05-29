'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, Loader2, Microscope } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePipeline } from '../hooks/use-interview-lens'

const statusColor: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  analyzing: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  ready: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200',
  failed: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  interviewed: 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200',
}

export function InterviewLensPipelineWidget() {
  const { data: pipeline = [], isLoading, isError, refetch } = usePipeline()
  const router = useRouter()

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Interview Lens pipeline</CardTitle>
          <Microscope className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className="border-red-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Interview Lens pipeline</CardTitle>
          <AlertCircle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-xs text-red-600">Failed to load.</div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="w-full mt-2 text-xs">Retry</Button>
        </CardContent>
      </Card>
    )
  }

  const totalSubmissions = pipeline.reduce((acc, r) => acc + r.submissions.length, 0)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Interview Lens pipeline</CardTitle>
        <Microscope className="h-4 w-4 text-blue-600" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-medium">{totalSubmissions}</div>
        <p className="text-xs text-muted-foreground">{totalSubmissions === 1 ? 'submission' : 'submissions'} across {pipeline.length} {pipeline.length === 1 ? 'role' : 'roles'}</p>

        {pipeline.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-3">No roles yet. Add one in Settings → Interview Lens.</p>
        ) : (
          <div className="mt-3 space-y-3 max-h-64 overflow-y-auto">
            {pipeline.filter((r) => r.submissions.length > 0).map((r) => (
              <div key={r.role_id}>
                <p className="text-xs font-medium text-muted-foreground mb-1">{r.role_title}</p>
                <div className="space-y-1">
                  {r.submissions.map((s) => (
                    <a
                      key={s.id}
                      href={`/interview-lens/${s.id}`}
                      className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-accent/50"
                    >
                      <span className="truncate flex-1">{s.candidate_name}</span>
                      {s.avg_score != null && <span className="text-xs text-muted-foreground mr-2">{s.avg_score.toFixed(1)}/5</span>}
                      <Badge variant="secondary" className={statusColor[s.status] ?? ''}>{s.status}</Badge>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <Button variant="ghost" size="sm" className="w-full mt-3 text-xs" onClick={() => router.push('/interview-lens')}>
          <Microscope className="w-3 h-3 mr-1" />Open Interview Lens
        </Button>
      </CardContent>
    </Card>
  )
}
