'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronLeft, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useSubmission } from '../../hooks/use-interview-lens'
import { SubmissionDetailView } from '../../components/submission-detail'
import { z } from 'zod'

const uuidSchema = z.string().uuid()

export default function SubmissionDetailPage() {
  const pathname = usePathname()
  const router = useRouter()
  const rawId = pathname?.split('/').at(-1) ?? ''
  const id = uuidSchema.safeParse(rawId).success ? rawId : null
  const { data, isLoading, isError, error } = useSubmission(id)

  return (
    <div className="p-6 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push('/interview-lens')}>
        <ChevronLeft className="w-4 h-4 mr-1" />All submissions
      </Button>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />Loading submission…
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : 'Unknown error'}</AlertDescription>
        </Alert>
      )}

      {data && <SubmissionDetailView detail={data} />}
    </div>
  )
}
