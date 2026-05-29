'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft, FileText, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useRoles, useReports } from '../../hooks/use-interview-lens'

function hireScoreColor(score: number) {
  if (score >= 70) return 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200'
  if (score >= 40) return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
  return 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
}

export default function ReportsListPage() {
  const router = useRouter()
  const [selectedRoleId, setSelectedRoleId] = useState<string | undefined>(undefined)
  const { data: roles = [] } = useRoles()
  const { data: reports = [], isLoading, isError } = useReports(selectedRoleId)

  const roleCounts = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.role_id] = (acc[r.role_id] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="flex h-full min-h-screen">
      {/* Left nav */}
      <aside className="w-52 shrink-0 border-r bg-muted/30 p-4 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Filter by Role</p>
        <button
          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${!selectedRoleId ? 'bg-accent font-medium' : 'hover:bg-accent/60'}`}
          onClick={() => setSelectedRoleId(undefined)}
        >
          All Reports
          <span className="ml-1 text-xs text-muted-foreground">({reports.length})</span>
        </button>
        {roles.map((role) => {
          const count = roleCounts[role.id] ?? 0
          return (
            <button
              key={role.id}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedRoleId === role.id ? 'bg-accent font-medium' : 'hover:bg-accent/60'}`}
              onClick={() => setSelectedRoleId(selectedRoleId === role.id ? undefined : role.id)}
            >
              {role.title}
              {count > 0 && <span className="ml-1 text-xs text-muted-foreground">({count})</span>}
            </button>
          )
        })}
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/interview-lens')}>
            <ArrowLeft className="w-4 h-4 mr-1" />Dashboard
          </Button>
          <h1 className="text-2xl font-medium flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />Interview Reports
          </h1>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />Loading…
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load reports. Please refresh.</AlertDescription>
          </Alert>
        )}

        {!isLoading && !isError && reports.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-3">
              <FileText className="w-10 h-10 mx-auto opacity-40" />
              <p>No reports yet{selectedRoleId ? ' for this role' : ''}.</p>
              <p className="text-xs">Complete an interview and click "Submit Interview &amp; Generate Report" to create one.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && reports.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {selectedRoleId ? roles.find((r) => r.id === selectedRoleId)?.title ?? 'Role' : 'All Reports'} ({reports.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/40 transition-colors cursor-pointer"
                  onClick={() => router.push(`/interview-lens/reports/${r.submission_id}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.candidate_name}</span>
                      <Badge variant="secondary" className={hireScoreColor(r.hire_score)}>
                        {r.hire_score}/100
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.role_title} · {new Date(r.generated_at).toLocaleString()}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0">View</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
