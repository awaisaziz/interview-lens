'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role, Submission, SubmissionDetail, PipelineRow, Question, Report, ReportListItem } from '../types'

const ROLES_KEY = ['interview-lens', 'roles']
const SUBMISSIONS_KEY = ['interview-lens', 'submissions']
const PIPELINE_KEY = ['interview-lens', 'pipeline']
const SETTINGS_KEY = ['interview-lens', 'settings']
const REPORTS_KEY = ['interview-lens', 'reports']
const submissionKey = (id: string) => ['interview-lens', 'submission', id]
const reportsKey = (roleId?: string) => roleId ? ['interview-lens', 'reports', roleId] : REPORTS_KEY

async function jsonOrThrow(res: Response): Promise<any> {
  const text = await res.text()
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try { const j = JSON.parse(text); msg = j.error ?? msg } catch {}
    throw new Error(msg)
  }
  return text ? JSON.parse(text) : {}
}

// ─── Roles ──────────────────────────────────────────────────────────────
export function useRoles() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: async (): Promise<Role[]> => {
      const j = await jsonOrThrow(await fetch('/api/modules/interview-lens/roles'))
      return j.roles ?? []
    },
  })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { title: string; seniority?: string | null; focus_notes?: string | null }): Promise<Role> => {
      const j = await jsonOrThrow(await fetch('/api/modules/interview-lens/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }))
      return j.role
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ROLES_KEY })
      const previous = qc.getQueryData<Role[]>(ROLES_KEY)
      const optimistic: Role = {
        id: `temp-${Date.now()}`,
        user_id: '',
        title: input.title,
        seniority: input.seniority ?? null,
        focus_notes: input.focus_notes ?? null,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<Role[]>(ROLES_KEY, (old = []) => [optimistic, ...old])
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(ROLES_KEY, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ROLES_KEY }),
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { id: string; patch: Partial<Pick<Role, 'title' | 'seniority' | 'focus_notes'>> }): Promise<Role> => {
      const j = await jsonOrThrow(await fetch(`/api/modules/interview-lens/roles/${args.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args.patch),
      }))
      return j.role
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ROLES_KEY })
      const previous = qc.getQueryData<Role[]>(ROLES_KEY)
      qc.setQueryData<Role[]>(ROLES_KEY, (old = []) =>
        old.map((r) => (r.id === args.id ? { ...r, ...args.patch } : r)),
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(ROLES_KEY, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ROLES_KEY }),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await jsonOrThrow(await fetch(`/api/modules/interview-lens/roles/${id}`, { method: 'DELETE' }))
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ROLES_KEY })
      const previous = qc.getQueryData<Role[]>(ROLES_KEY)
      qc.setQueryData<Role[]>(ROLES_KEY, (old = []) => old.filter((r) => r.id !== id))
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(ROLES_KEY, ctx.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ROLES_KEY })
      qc.invalidateQueries({ queryKey: SUBMISSIONS_KEY })
      qc.invalidateQueries({ queryKey: PIPELINE_KEY })
    },
  })
}

// ─── Submissions ────────────────────────────────────────────────────────
export function useSubmissions(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: [...SUBMISSIONS_KEY, params],
    queryFn: async (): Promise<Submission[]> => {
      const qs = params ? `?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString()}` : ''
      const j = await jsonOrThrow(await fetch(`/api/modules/interview-lens/submissions${qs}`))
      return j.submissions ?? []
    },
  })
}

export function useSubmission(id: string | null) {
  return useQuery({
    queryKey: id ? submissionKey(id) : ['interview-lens', 'submission', 'none'],
    enabled: !!id,
    queryFn: async (): Promise<SubmissionDetail> => {
      const j = await jsonOrThrow(await fetch(`/api/modules/interview-lens/submissions/${id}`))
      return j as SubmissionDetail
    },
    refetchInterval: (q) => {
      const data = q.state.data as SubmissionDetail | undefined
      return data?.submission?.status === 'analyzing' ? 1500 : false
    },
  })
}

export function useCreateSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      role_id: string
      candidate_name: string
      source_type: 'github_url' | 'pasted_code'
      source_ref?: string | null
      pasted_content?: string | null
    }): Promise<{ submission: Submission; partial: boolean; note: string | null }> => {
      const j = await jsonOrThrow(await fetch('/api/modules/interview-lens/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }))
      return j
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: SUBMISSIONS_KEY })
      const previous = qc.getQueryData<Submission[]>(SUBMISSIONS_KEY)
      const optimistic: Submission = {
        id: `temp-${Date.now()}`,
        user_id: '',
        role_id: input.role_id,
        candidate_name: input.candidate_name,
        source_type: input.source_type,
        source_ref: input.source_ref ?? null,
        pasted_content: input.pasted_content ?? null,
        repo_digest: null,
        error_message: null,
        status: 'pending',
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<Submission[]>(SUBMISSIONS_KEY, (old = []) => [optimistic, ...old])
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(SUBMISSIONS_KEY, ctx.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SUBMISSIONS_KEY })
      qc.invalidateQueries({ queryKey: PIPELINE_KEY })
    },
  })
}

export function useAnalyzeSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await jsonOrThrow(await fetch(`/api/modules/interview-lens/submissions/${id}/analyze`, { method: 'POST' }))
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: submissionKey(id) })
      const previous = qc.getQueryData<SubmissionDetail>(submissionKey(id))
      if (previous) {
        qc.setQueryData<SubmissionDetail>(submissionKey(id), {
          ...previous,
          submission: { ...previous.submission, status: 'analyzing' },
        })
      }
      return { previous }
    },
    onError: (_e, id, ctx) => {
      if (ctx?.previous) qc.setQueryData(submissionKey(id), ctx.previous)
    },
    onSettled: (_d, _e, id) => {
      qc.invalidateQueries({ queryKey: submissionKey(id) })
      qc.invalidateQueries({ queryKey: SUBMISSIONS_KEY })
      qc.invalidateQueries({ queryKey: PIPELINE_KEY })
    },
  })
}

export function useDeleteSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await jsonOrThrow(await fetch(`/api/modules/interview-lens/submissions/${id}`, { method: 'DELETE' }))
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: SUBMISSIONS_KEY })
      const previous = qc.getQueryData<Submission[]>(SUBMISSIONS_KEY)
      qc.setQueryData<Submission[]>(SUBMISSIONS_KEY, (old = []) => old.filter((s) => s.id !== id))
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(SUBMISSIONS_KEY, ctx.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SUBMISSIONS_KEY })
      qc.invalidateQueries({ queryKey: PIPELINE_KEY })
    },
  })
}

// ─── Questions ──────────────────────────────────────────────────────────
export function useUpdateQuestion(submissionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { id: string; interviewer_notes?: string; score?: number | null; skipped?: boolean }): Promise<Question> => {
      const { id, ...patch } = args
      const j = await jsonOrThrow(await fetch(`/api/modules/interview-lens/questions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }))
      return j.question
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: submissionKey(submissionId) })
      const previous = qc.getQueryData<SubmissionDetail>(submissionKey(submissionId))
      if (previous) {
        qc.setQueryData<SubmissionDetail>(submissionKey(submissionId), {
          ...previous,
          questions: previous.questions.map((q) => q.id === args.id ? { ...q, ...args, interviewer_notes: args.interviewer_notes ?? q.interviewer_notes, score: args.score === undefined ? q.score : args.score, skipped: args.skipped === undefined ? q.skipped : args.skipped } : q),
        })
      }
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(submissionKey(submissionId), ctx.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: submissionKey(submissionId) })
      qc.invalidateQueries({ queryKey: PIPELINE_KEY })
    },
  })
}

// ─── Pipeline ───────────────────────────────────────────────────────────
export function usePipeline() {
  return useQuery({
    queryKey: PIPELINE_KEY,
    queryFn: async (): Promise<PipelineRow[]> => {
      const j = await jsonOrThrow(await fetch('/api/modules/interview-lens/pipeline'))
      return j.pipeline ?? []
    },
  })
}

// ─── Settings ───────────────────────────────────────────────────────────
export function useInterviewLensSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async (): Promise<Record<string, unknown>> => {
      const res = await fetch('/api/modules/interview-lens/settings')
      if (!res.ok) return {}
      return res.json()
    },
  })
}

export function useUpdateInterviewLensSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>): Promise<void> => {
      await jsonOrThrow(await fetch('/api/modules/interview-lens/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }))
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: SETTINGS_KEY })
      const previous = qc.getQueryData<Record<string, unknown>>(SETTINGS_KEY)
      qc.setQueryData<Record<string, unknown>>(SETTINGS_KEY, (old = {}) => ({ ...old, ...patch }))
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(SETTINGS_KEY, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })
}

// ─── Reports ─────────────────────────────────────────────────────────────
export function useGenerateReport(submissionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<Report> => {
      const j = await jsonOrThrow(await fetch(`/api/modules/interview-lens/submissions/${submissionId}/report`, { method: 'POST' }))
      return j.report
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: submissionKey(submissionId) })
      await qc.cancelQueries({ queryKey: ['interview-lens', 'report', submissionId] })
      const previousReport = qc.getQueryData<Report | null | undefined>(['interview-lens', 'report', submissionId])
      return { previousReport, hasPrevious: previousReport !== undefined }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.hasPrevious) {
        qc.setQueryData(['interview-lens', 'report', submissionId], ctx.previousReport)
      }
      qc.invalidateQueries({ queryKey: submissionKey(submissionId) })
      qc.invalidateQueries({ queryKey: ['interview-lens', 'report', submissionId] })
      qc.invalidateQueries({ queryKey: SUBMISSIONS_KEY })
      qc.invalidateQueries({ queryKey: REPORTS_KEY })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: submissionKey(submissionId) })
      qc.invalidateQueries({ queryKey: ['interview-lens', 'report', submissionId] })
      qc.invalidateQueries({ queryKey: SUBMISSIONS_KEY })
      qc.invalidateQueries({ queryKey: PIPELINE_KEY })
      qc.invalidateQueries({ queryKey: REPORTS_KEY })
    },
  })
}

export function useDeleteReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (submissionId: string): Promise<void> => {
      await jsonOrThrow(await fetch(`/api/modules/interview-lens/submissions/${submissionId}/report`, { method: 'DELETE' }))
    },
    onMutate: async (submissionId) => {
      await qc.cancelQueries({ queryKey: ['interview-lens', 'report', submissionId] })
      await qc.cancelQueries({ queryKey: REPORTS_KEY })
      const previousReport = qc.getQueryData<Report | null | undefined>(['interview-lens', 'report', submissionId])
      // Track whether we had a cached value so we can safely rollback even when
      // the cached report was null (no report) vs undefined (cache miss).
      const hasPrevious = previousReport !== undefined
      qc.setQueryData(['interview-lens', 'report', submissionId], null)
      return { previousReport, hasPrevious }
    },
    onError: (_e, submissionId, ctx) => {
      if (ctx?.hasPrevious) qc.setQueryData(['interview-lens', 'report', submissionId], ctx.previousReport)
    },
    onSettled: (_d, _e, submissionId) => {
      qc.invalidateQueries({ queryKey: submissionKey(submissionId) })
      qc.invalidateQueries({ queryKey: ['interview-lens', 'report', submissionId] })
      qc.invalidateQueries({ queryKey: SUBMISSIONS_KEY })
      qc.invalidateQueries({ queryKey: PIPELINE_KEY })
      qc.invalidateQueries({ queryKey: REPORTS_KEY })
    },
  })
}

export function useReport(submissionId: string | null) {
  return useQuery({
    queryKey: submissionId ? ['interview-lens', 'report', submissionId] : ['interview-lens', 'report', 'none'],
    enabled: !!submissionId,
    queryFn: async (): Promise<Report | null> => {
      const res = await fetch(`/api/modules/interview-lens/submissions/${submissionId}/report`)
      if (res.status === 404) return null
      return (await jsonOrThrow(res)).report
    },
  })
}

export function useReports(roleId?: string, params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: [...reportsKey(roleId), params],
    queryFn: async (): Promise<ReportListItem[]> => {
      const search = new URLSearchParams()
      if (roleId) search.set('role_id', roleId)
      if (params?.limit !== undefined) search.set('limit', String(params.limit))
      if (params?.offset !== undefined) search.set('offset', String(params.offset))
      const qs = search.toString() ? `?${search.toString()}` : ''
      const j = await jsonOrThrow(await fetch(`/api/modules/interview-lens/reports${qs}`))
      return j.reports ?? []
    },
  })
}
