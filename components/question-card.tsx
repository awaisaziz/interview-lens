'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, FileCode2 } from 'lucide-react'
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
  const [showAnswer, setShowAnswer] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setNotes(question.interviewer_notes)
    setScore(question.score)
  }, [question.id, question.interviewer_notes, question.score])

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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Badge className={tierColor[question.tier]} variant="secondary">{question.tier}</Badge>
          <CardTitle className="text-base flex-1 leading-snug">{question.prompt}</CardTitle>
        </div>
        {question.anchor_file && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <FileCode2 className="w-3 h-3" />
            <code className="font-mono">{question.anchor_file}</code>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Collapsible open={showAnswer} onOpenChange={setShowAnswer}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
              What a strong answer sounds like
              <ChevronDown className={`w-3 h-3 transition-transform ${showAnswer ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 px-1">
            <SafeMarkdown>{question.strong_answer_md}</SafeMarkdown>
          </CollapsibleContent>
        </Collapsible>

        <div className="space-y-2 pt-2 border-t">
          <label className="text-xs font-medium text-muted-foreground">Interviewer notes (saves automatically)</label>
          <Textarea value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="What did the candidate say? Did it match a strong answer?" rows={3} className="text-sm" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Score:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={score === n ? 'default' : 'outline'}
                className="h-7 w-7 p-0"
                onClick={() => onScoreChange(score === n ? null : n)}
              >
                {n}
              </Button>
            ))}
            {score !== null && (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => onScoreChange(null)}>clear</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
