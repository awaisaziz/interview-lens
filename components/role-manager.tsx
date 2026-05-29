'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from '../hooks/use-interview-lens'
import type { Role } from '../types'

function RoleRow({ role }: { role: Role }) {
  const updateRole = useUpdateRole()
  const deleteRole = useDeleteRole()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(role.title)
  const [seniority, setSeniority] = useState(role.seniority ?? '')
  const [focusNotes, setFocusNotes] = useState(role.focus_notes ?? '')

  const cancelEdit = () => {
    setTitle(role.title)
    setSeniority(role.seniority ?? '')
    setFocusNotes(role.focus_notes ?? '')
    setEditing(false)
  }

  const handleSave = () => {
    if (!title.trim()) return
    updateRole.mutate(
      { id: role.id, patch: { title: title.trim(), seniority: seniority.trim() || null, focus_notes: focusNotes.trim() || null } },
      {
        onSuccess: () => { setEditing(false); toast({ title: 'Role updated' }) },
        onError: (err) => toast({ variant: 'destructive', title: 'Failed to update role', description: err.message }),
      },
    )
  }

  const handleDelete = () => {
    if (!confirm(`Delete role "${role.title}"? Existing submissions using this role will still reference it.`)) return
    deleteRole.mutate(role.id, {
      onError: (err) => toast({ variant: 'destructive', title: 'Failed to delete role', description: err.message }),
    })
  }

  if (editing) {
    return (
      <div className="p-3 border rounded-lg space-y-3 bg-muted/30">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`edit-title-${role.id}`} className="text-xs">Title</Label>
            <Input id={`edit-title-${role.id}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`edit-seniority-${role.id}`} className="text-xs">Seniority</Label>
            <Input id={`edit-seniority-${role.id}`} value={seniority} onChange={(e) => setSeniority(e.target.value)} maxLength={100} className="h-8 text-sm" />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`edit-focus-${role.id}`} className="text-xs">Focus notes</Label>
          <Textarea id={`edit-focus-${role.id}`} value={focusNotes} onChange={(e) => setFocusNotes(e.target.value)} rows={3} maxLength={4000} className="text-sm" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={updateRole.isPending || !title.trim()}>
            {updateRole.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={updateRole.isPending}>
            <X className="w-3 h-3 mr-1" />Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="font-medium">{role.title}{role.seniority ? ` · ${role.seniority}` : ''}</div>
        {role.focus_notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-2">{role.focus_notes}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-7 w-7 p-0" aria-label="Edit role">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleteRole.isPending} className="h-7 w-7 p-0 text-red-600 hover:text-red-700" aria-label="Delete role">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function RoleManager() {
  const { data: roles = [], isLoading } = useRoles()
  const createRole = useCreateRole()
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [seniority, setSeniority] = useState('')
  const [focusNotes, setFocusNotes] = useState('')

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    createRole.mutate(
      { title: title.trim(), seniority: seniority.trim() || null, focus_notes: focusNotes.trim() || null },
      {
        onSuccess: () => {
          setTitle(''); setSeniority(''); setFocusNotes('')
          toast({ title: 'Role created' })
        },
        onError: (err) => toast({ variant: 'destructive', title: 'Failed to create role', description: err.message }),
      },
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New role</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="role-title">Title</Label>
                <Input id="role-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Backend Engineer" required maxLength={200} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="role-seniority">Seniority</Label>
                <Input id="role-seniority" value={seniority} onChange={(e) => setSeniority(e.target.value)} placeholder="Mid-level" maxLength={100} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="role-focus">Focus notes</Label>
              <Textarea id="role-focus" value={focusNotes} onChange={(e) => setFocusNotes(e.target.value)} placeholder="What the team cares about: API design, testing rigor, debugging skill, etc." rows={3} maxLength={4000} />
            </div>
            <Button type="submit" disabled={createRole.isPending || !title.trim()}>
              {createRole.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add role
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Existing roles ({roles.length})</h4>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles yet. Add one above.</p>
        ) : (
          <div className="space-y-2">
            {roles.map((r) => <RoleRow key={r.id} role={r} />)}
          </div>
        )}
      </div>
    </div>
  )
}
