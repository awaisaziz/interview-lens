'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, FileCode2, SkipForward } from 'lucide-react'
import type { Question } from '../types'
import { SafeMarkdown } from './safe-markdown'
import { useUpdateQuestion } from '../hooks/use-interview-lens'

const tierColor: Record<Question['tier'], string> = {
  easy: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200',
  medium: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  hard: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
}

export function QuestionCard({ question, submissionId }: { question: Question; submissionId: string }) {
  const update = useUpdateQuestion(submissionId)
  const [notes, setNotes] = useState(question.interviewer_notes)
  const [score, setScore] = useState<number | null>(question.score)
  const [skipped, setSkipped] = useState(question.skipped)
  const [showAnswer, setShowAnswer] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setNotes(question.interviewer_notes)
    setScore(question.score)
    setSkipped(question.skipped)
  }, [question.id, question.interviewer_notes, question.score, question.skipped])

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  const flush = (patch: { interviewer_notes?: string; score?: number | null }) => {
    update.mutate({ id: question.id, ...patch })
  }

  const onNotesChange = (v: string) => {
    setNotes(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => flush({ interviewer_notes: v }), 500)
  }

  const onScoreChange = (n: number | null) => {
    setScore(n)
    flush({ score: n })
  }

  const onSkipToggle = () => {
    const next = !skipped
    setSkipped(next)
    update.mutate({ id: question.id, skipped: next })
  }

  return (
    <Card className={skipped ? 'opacity-50' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Badge className={tierColor[question.tier]} variant="secondary">{question.tier}</Badge>
          {skipped && <Badge variant="secondary" className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Skipped</Badge>}
          <CardTitle className="text-base flex-1 leading-snug">{question.prompt}</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0 text-xs text-muted-foreground h-7 px-2"
            onClick={onSkipToggle}
            title={skipped ? 'Un-skip this question' : 'Skip this question'}
          >
            <SkipForward className="w-3 h-3 mr-1" />
            {skipped ? 'Un-skip' : 'Skip'}
          </Button>
        </div>
        {question.anchor_file && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <FileCode2 className="w-3 h-3" aria-hidden="true" />
            <code className="font-mono">{question.anchor_file}</code>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Collapsible open={showAnswer} onOpenChange={setShowAnswer}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
              What a strong answer sounds like
              <ChevronDown className={`w-3 h-3 transition-transform ${showAnswer ? 'rotate-180' : ''}`} aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 px-1">
            <SafeMarkdown>{question.strong_answer_md}</SafeMarkdown>
          </CollapsibleContent>
        </Collapsible>

        <div className="space-y-2 pt-2 border-t">
          <label htmlFor={`notes-${question.id}`} className="text-xs font-medium text-muted-foreground">Candidate's answer / notes <span className="font-normal">(saves automatically)</span></label>
          <Textarea id={`notes-${question.id}`} value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="What did the candidate say? Key points, examples they mentioned…" rows={3} className="text-sm" disabled={skipped} />
          <fieldset className="flex items-center gap-2 border-0 p-0 m-0">
            <legend className="sr-only">Score for this answer</legend>
            <span className="text-xs text-muted-foreground" aria-hidden="true">Your rating</span>
            <span className="text-xs text-muted-foreground/60" aria-hidden="true">— how did you feel about this answer?</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={score === n ? 'default' : 'outline'}
                className="h-7 w-7 p-0"
                onClick={() => onScoreChange(score === n ? null : n)}
                disabled={update.isPending || skipped}
                aria-label={`${n} out of 5${score === n ? ' (selected)' : ''}`}
                aria-pressed={score === n}
              >
                {n}
              </Button>
            ))}
            {score !== null && (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => onScoreChange(null)}>clear</Button>
            )}
          </fieldset>
        </div>
      </CardContent>
    </Card>
  )
}
