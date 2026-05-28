// Build a normalized repo_digest from one of two input shapes (pasted_code
// primary, github_url secondary). Downstream code only ever sees the string.

const MAX_DIGEST_CHARS = 80_000
const MAX_FILE_BYTES = 50_000
const MAX_FILES = 12

const SKIP_DIRS = ['node_modules', 'dist', 'build', '.next', 'vendor', '.git', '.turbo', 'coverage']
const SKIP_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.tar', '.gz', '.lock', '.lockb', '.wasm', '.mp4', '.mov', '.woff', '.woff2', '.ttf']
const LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'poetry.lock', 'Cargo.lock']

const PRIORITY_NAMES = ['README', 'README.md', 'README.rst', 'README.txt', 'package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'requirements.txt']
const ENTRY_PATTERNS = [/^(?:src\/)?main\.[a-z]+$/i, /^(?:src\/)?index\.[a-z]+$/i, /^(?:src\/)?app\.[a-z]+$/i]

export type DigestResult = { digest: string; partial: boolean; note?: string }

export async function buildDigest(input: {
  sourceType: 'github_url' | 'pasted_code'
  sourceRef?: string | null
  pastedContent?: string | null
}): Promise<DigestResult> {
  if (input.sourceType === 'pasted_code') {
    return { digest: digestFromPaste(input.pastedContent ?? ''), partial: false }
  }
  return digestFromGithub(input.sourceRef ?? '')
}

function digestFromPaste(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  // Recognize blocks split by `--- filename ---` markers.
  const markerRe = /^---\s*([^\n]+?)\s*---\s*$/gm
  const matches = [...trimmed.matchAll(markerRe)]
  if (matches.length === 0) {
    return cap(`// pasted.txt\n${trimmed}`)
  }
  const parts: string[] = []
  for (let i = 0; i < matches.length; i++) {
    const filename = matches[i][1].trim().replace(/[\r\n]/g, '').slice(0, 200)
    const start = matches[i].index! + matches[i][0].length
    const end = i + 1 < matches.length ? matches[i + 1].index! : trimmed.length
    const body = trimmed.slice(start, end).trim()
    if (!body) continue
    parts.push(`// ${filename}\n${body}`)
  }
  return cap(parts.join('\n\n'))
}

async function digestFromGithub(url: string): Promise<DigestResult> {
  const parsed = parseGithubUrl(url)
  if (!parsed) {
    return { digest: '', partial: true, note: 'Not a recognized GitHub URL. Paste README/code instead.' }
  }
  const { owner, repo } = parsed
  try {
    const branch = await detectDefaultBranch(owner, repo)
    if (!branch) return { digest: '', partial: true, note: 'Repo not reachable (private, deleted, or rate-limited). Paste README/code instead.' }

    const treeRes = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`)
    if (!treeRes) return { digest: '', partial: true, note: 'GitHub tree fetch failed. Paste README/code instead.' }
    const blobs: Array<{ path: string; size: number }> = (treeRes.tree ?? [])
      .filter((t: { type: string }) => t.type === 'blob')
      .map((t: { path: string; size?: number }) => ({ path: t.path, size: t.size ?? 0 }))

    const ranked = rankFiles(blobs)
    if (ranked.length === 0) {
      return { digest: '', partial: true, note: 'No analyzable files found in repo.' }
    }

    const parts: string[] = []
    let used = 0
    for (const file of ranked) {
      if (parts.length >= MAX_FILES) break
      if (file.size > MAX_FILE_BYTES) continue
      const content = await fetchText(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`)
      if (content === null) continue
      const block = `// ${file.path}\n${content.trim()}`
      if (used + block.length > MAX_DIGEST_CHARS) break
      parts.push(block)
      used += block.length
    }
    if (parts.length === 0) {
      return { digest: '', partial: true, note: 'GitHub files unreadable. Paste README/code instead.' }
    }
    return { digest: cap(parts.join('\n\n')), partial: false }
  } catch {
    return { digest: '', partial: true, note: 'GitHub fetch failed. Paste README/code instead.' }
  }
}

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return null
    const segs = u.pathname.split('/').filter(Boolean)
    if (segs.length < 2) return null
    const owner = segs[0]
    const repo = segs[1].replace(/\.git$/i, '')
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,38}[a-zA-Z0-9])?$/.test(owner) || !/^[\w.-]{1,100}$/.test(repo)) return null
    return { owner, repo }
  } catch {
    return null
  }
}

async function detectDefaultBranch(owner: string, repo: string): Promise<string | null> {
  const meta = await fetchJson(`https://api.github.com/repos/${owner}/${repo}`)
  if (meta?.default_branch && typeof meta.default_branch === 'string') return meta.default_branch
  // Fallback: try common names.
  for (const guess of ['main', 'master']) {
    const ok = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${guess}/README.md`, { method: 'HEAD' })
      .then((r) => r.ok)
      .catch(() => false)
    if (ok) return guess
  }
  return null
}

function rankFiles(blobs: Array<{ path: string; size: number }>): Array<{ path: string; size: number }> {
  const usable = blobs.filter((b) => {
    if (b.size === 0) return false
    if (SKIP_DIRS.some((d) => b.path === d || b.path.startsWith(`${d}/`) || b.path.includes(`/${d}/`))) return false
    const base = b.path.split('/').pop() ?? ''
    if (LOCKFILES.includes(base)) return false
    if (SKIP_EXTS.some((ext) => b.path.toLowerCase().endsWith(ext))) return false
    return true
  })
  const score = (path: string): number => {
    const base = path.split('/').pop() ?? ''
    if (PRIORITY_NAMES.some((n) => base.toUpperCase().startsWith(n.toUpperCase().replace(/\.[A-Z]+$/, '')))) return 0
    if (ENTRY_PATTERNS.some((re) => re.test(path))) return 1
    if (path.startsWith('src/')) return 2
    return 3
  }
  usable.sort((a, b) => {
    const sa = score(a.path), sb = score(b.path)
    if (sa !== sb) return sa - sb
    // Within same tier, prefer smaller files first up to entry tier, larger after.
    return sa <= 1 ? a.size - b.size : b.size - a.size
  })
  return usable.slice(0, MAX_FILES * 2) // overfetch — we'll truncate during read
}

const FETCH_TIMEOUT_MS = 8_000
const MAX_RESPONSE_BYTES = 2_000_000 // 2 MB guard

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/vnd.github+json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const text = await res.text()
    if (text.length > MAX_RESPONSE_BYTES) return null
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return null
    const text = await res.text()
    if (text.length > MAX_RESPONSE_BYTES) return null
    return text
  } catch {
    return null
  }
}

function cap(s: string): string {
  return s.length > MAX_DIGEST_CHARS ? s.slice(0, MAX_DIGEST_CHARS) + '\n\n// [truncated]' : s
}
