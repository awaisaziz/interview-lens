'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, AlertCircle } from 'lucide-react'
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

  if (!id) return (
    <div className="p-6">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Invalid submission ID.</AlertDescription>
      </Alert>
    </div>
  )

  return (
    <div className="p-6 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push('/interview-lens')}>
        <ChevronLeft className="w-4 h-4 mr-1" />All submissions
      </Button>

      {isLoading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
            <div className="lg:col-span-3 space-y-3">
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
          </div>
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
