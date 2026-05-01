import type { ReactNode } from 'react'

type Props = {
  title: string
  links?: string[] | null
}

type Token =
  | { start: number; end: number; kind: 'bracket'; n: number }
  | { start: number; end: number; kind: 'named'; n: number; label: string }

function collectTokens(title: string): Token[] {
  const tokens: Token[] = []
  const reBracket = /\[(\d+)\]/g
  let m: RegExpExecArray | null
  while ((m = reBracket.exec(title)) !== null) {
    const n = parseInt(m[1] ?? '0', 10)
    if (n >= 1) tokens.push({ start: m.index, end: reBracket.lastIndex, kind: 'bracket', n })
  }
  const reNamed = /\{\{(\d+):([^}]+)\}\}/g
  while ((m = reNamed.exec(title)) !== null) {
    const label = (m[2] ?? '').trim()
    if (!label) continue
    const n = parseInt(m[1] ?? '0', 10)
    if (n >= 1) tokens.push({ start: m.index, end: reNamed.lastIndex, kind: 'named', n, label })
  }
  tokens.sort((a, b) => a.start - b.start || a.end - b.end)
  const out: Token[] = []
  let cursor = 0
  for (const t of tokens) {
    if (t.start < cursor) continue
    out.push(t)
    cursor = t.end
  }
  return out
}

/**
 * Renders checklist item title with [1], [2], etc. as clickable links.
 * links[0] maps to [1], links[1] to [2], etc.
 * Also supports {{1:Label}} for custom anchor text using the same link index.
 */
export function ChecklistTitleWithLinks({ title, links }: Props) {
  const urlList = links?.filter(Boolean) ?? []
  if (urlList.length === 0) return <>{title}</>

  const tokens = collectTokens(title)
  if (tokens.length === 0) return <>{title}</>

  const parts: ReactNode[] = []
  let lastIndex = 0
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    const before = title.slice(lastIndex, t.start)
    if (before) parts.push(before)

    const url = urlList[t.n - 1]
    const key = `${t.start}-${t.kind}-${t.n}-${i}`
    if (url != null) {
      const anchorChildren =
        t.kind === 'named' ? t.label : `[${t.n}]`
      parts.push(
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#2563eb', textDecoration: 'underline' }}
        >
          {anchorChildren}
        </a>
      )
    } else {
      parts.push(title.slice(t.start, t.end))
    }
    lastIndex = t.end
  }
  if (lastIndex < title.length) parts.push(title.slice(lastIndex))

  return <>{parts}</>
}
