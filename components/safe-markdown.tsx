'use client'

import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { cn } from '@/lib/utils'

// Markdown rendered from untrusted model+candidate input. rehype-sanitize strips
// raw HTML, dangerous URLs, and event handlers. NEVER swap to `rehype-raw`.
export function SafeMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{children}</ReactMarkdown>
    </div>
  )
}
