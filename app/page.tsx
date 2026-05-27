'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Loader2, Microscope, Plus, Settings, Trash2 } from 'lucide-react'
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
  const { data: submissions = [], isLoading } = useSubmissions()
  const { data: roles = [] } = useRoles()
  const deleteSubmission = useDeleteSubmission()
  const { toast } = useToast()
  const [rolesOpen, setRolesOpen] = useState(false)

  const roleById = new Map(roles.map((r) => [r.id, r]))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-medium flex items-center gap-2"><Microscope className="w-7 h-7 text-blue-600" />Interview Lens</h1>
          <p className="text-sm text-muted-foreground mt-1">Submit a candidate's take-home, generate a structured brief, score answers live.</p>
        </div>
        <div className="flex items-center gap-2">
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
        <CardHeader><CardTitle className="text-base">Submissions ({submissions.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
          ) : submissions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Microscope className="w-10 h-10 mx-auto mb-2 opacity-50" />
              No submissions yet.
            </div>
          ) : (
            <div className="space-y-2">
              {submissions.map((s) => {
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
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => {
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
    </div>
  )
}
