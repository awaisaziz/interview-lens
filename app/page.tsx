'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Loader2, Microscope, Plus, Settings, Trash2, AlertCircle, FileText } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useRoles, useSubmissions, useDeleteSubmission } from '../hooks/use-interview-lens'
import { useToast } from '@/hooks/use-toast'
import { RoleManager } from '../components/role-manager'

const statusColor: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  analyzing: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  ready: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200',
  failed: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  interviewed: 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200',
}

export default function InterviewLensListPage() {
  const { data: submissions = [], isLoading, isError } = useSubmissions()
  const { data: roles = [] } = useRoles()
  const deleteSubmission = useDeleteSubmission()
  const { toast } = useToast()
  const [rolesOpen, setRolesOpen] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState<string | undefined>(undefined)

  const roleById = new Map(roles.map((r) => [r.id, r]))
  const filteredSubmissions = selectedRoleId
    ? submissions.filter((s) => s.role_id === selectedRoleId)
    : submissions

  const submissionCountByRole = submissions.reduce<Record<string, number>>((acc, s) => {
    acc[s.role_id] = (acc[s.role_id] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="flex min-h-screen">
      {/* Left role filter nav */}
      <aside className="w-52 shrink-0 border-r bg-muted/30 p-4 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Filter by Role</p>
        <button
          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${!selectedRoleId ? 'bg-accent font-medium' : 'hover:bg-accent/60'}`}
          onClick={() => setSelectedRoleId(undefined)}
        >
          All Submissions
          <span className="ml-1 text-xs text-muted-foreground">({submissions.length})</span>
        </button>
        {roles.map((role) => {
          const count = submissionCountByRole[role.id] ?? 0
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

      {/* Main content */}
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-medium flex items-center gap-2"><Microscope className="w-7 h-7 text-blue-600" />Interview Lens</h1>
            <p className="text-sm text-muted-foreground mt-1">Submit a candidate's take-home, generate a structured brief, score answers live.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => window.location.href = '/interview-lens/reports'}>
              <FileText className="w-4 h-4 mr-2" />View All Reports
            </Button>
            <Button variant="outline" onClick={() => setRolesOpen(true)}>
              <Settings className="w-4 h-4 mr-2" />Manage Roles
            </Button>
            <Button onClick={() => window.location.href = '/interview-lens/new'} disabled={roles.length === 0}>
              <Plus className="w-4 h-4 mr-2" />New submission
            </Button>
          </div>
        </div>

        <Sheet open={rolesOpen} onOpenChange={setRolesOpen}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Manage Roles</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <RoleManager />
            </div>
          </SheetContent>
        </Sheet>

        {roles.length === 0 && (
          <Card className="border-amber-300 dark:border-amber-800">
            <CardContent className="py-6 text-sm">
              You haven't set up any roles yet. Click <strong>Manage Roles</strong> above to add at least one role (with focus notes) before you can submit candidates.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedRoleId ? `${roleById.get(selectedRoleId)?.title ?? 'Role'} (${filteredSubmissions.length})` : `Submissions (${filteredSubmissions.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
            ) : isError ? (
              <Alert variant="destructive" className="my-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Failed to load submissions. Please refresh the page.</AlertDescription>
              </Alert>
            ) : filteredSubmissions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Microscope className="w-10 h-10 mx-auto mb-2 opacity-50" />
                {selectedRoleId ? 'No submissions for this role yet.' : 'No submissions yet.'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSubmissions.map((s) => {
                  const role = roleById.get(s.role_id)
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/40 transition-colors">
                      <div className="flex-1 cursor-pointer" onClick={() => window.location.href = `/interview-lens/${s.id}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{s.candidate_name}</span>
                          <Badge variant="secondary" className={statusColor[s.status] ?? ''}>{s.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {role?.title ?? '(deleted role)'} · {s.source_type === 'github_url' ? 'GitHub' : 'Pasted'} · {new Date(s.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-red-600" disabled={deleteSubmission.isPending} aria-label="Delete submission" onClick={() => {
                        if (confirm(`Delete submission for ${s.candidate_name}?`)) {
                          deleteSubmission.mutate(s.id, { onError: (e) => toast({ variant: 'destructive', title: 'Delete failed', description: e.message }) })
                        }
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
