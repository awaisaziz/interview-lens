'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role, Submission, SubmissionDetail, PipelineRow, Question } from '../types'

const ROLES_KEY = ['interview-lens', 'roles']
const SUBMISSIONS_KEY = ['interview-lens', 'submissions']
const PIPELINE_KEY = ['interview-lens', 'pipeline']
const SETTINGS_KEY = ['interview-lens', 'settings']
const submissionKey = (id: string) => ['interview-lens', 'submission', id]

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
    onSettled: () => qc.invalidateQueries({ queryKey: ROLES_KEY }),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await jsonOrThrow(await fetch(`/api/modules/interview-lens/roles/${id}`, { method: 'DELETE' }))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ROLES_KEY })
      qc.invalidateQueries({ queryKey: SUBMISSIONS_KEY })
      qc.invalidateQueries({ queryKey: PIPELINE_KEY })
    },
  })
}

// ─── Submissions ────────────────────────────────────────────────────────
export function useSubmissions() {
  return useQuery({
    queryKey: SUBMISSIONS_KEY,
    queryFn: async (): Promise<Submission[]> => {
      const j = await jsonOrThrow(await fetch('/api/modules/interview-lens/submissions'))
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
    mutationFn: async (args: { id: string; interviewer_notes?: string; score?: number | null }): Promise<Question> => {
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
          questions: previous.questions.map((q) => q.id === args.id ? { ...q, ...args, interviewer_notes: args.interviewer_notes ?? q.interviewer_notes, score: args.score === undefined ? q.score : args.score } : q),
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
    onSettled: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })
}
