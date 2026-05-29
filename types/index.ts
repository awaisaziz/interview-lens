export type SubmissionStatus = 'pending' | 'analyzing' | 'ready' | 'failed' | 'interviewed'
export type SourceType = 'github_url' | 'pasted_code'
export type Tier = 'easy' | 'medium' | 'hard'

export interface Role {
  id: string
  user_id: string
  title: string
  seniority: string | null
  focus_notes: string | null
  created_at: string
}

export interface Submission {
  id: string
  user_id: string
  role_id: string
  candidate_name: string
  source_type: SourceType
  source_ref: string | null
  pasted_content: string | null
  repo_digest: string | null
  error_message: string | null
  status: SubmissionStatus
  created_at: string
}

export interface StackItem {
  name: string
  role: string
}

export interface Brief {
  id: string
  submission_id: string
  summary_md: string
  stack_json: StackItem[]
  architecture_md: string
  signal_report_md: string
  generated_at: string
}

export interface Question {
  id: string
  submission_id: string
  tier: Tier
  prompt: string
  anchor_file: string | null
  strong_answer_md: string
  sort_order: number
  interviewer_notes: string
  score: number | null
  skipped: boolean
}

export interface Report {
  id: string
  submission_id: string
  user_id: string
  report_md: string
  recommendation_md: string
  hire_score: number
  generated_at: string
}

export interface ReportListItem {
  id: string
  submission_id: string
  candidate_name: string
  role_id: string
  role_title: string
  hire_score: number
  generated_at: string
}

export interface SubmissionDetail {
  submission: Submission
  brief: Brief | null
  questions: Question[]
  role: Role
  report: Report | null
}

export interface PipelineRow {
  role_id: string
  role_title: string
  submissions: Array<{
    id: string
    candidate_name: string
    status: SubmissionStatus
    avg_score: number | null
  }>
}
