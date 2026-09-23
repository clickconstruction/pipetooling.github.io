import type { ReactNode } from 'react'
import { dashAfterTokenLength, isJobDoorLink, splitJobLinkLabel } from '../lib/checklistJobChip'

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
 * The row chip (v2.3769): a named token whose link is a job door renders as a
 * chip — number badge, name, ↗ — instead of an underlined link, and the dash
 * the doors store after it is dropped from the display. It is an inline-flex
 * box so a done row's strike-through stays on the task text, and it never
 * breaks inside itself; a long name truncates and the badge stays visible.
 */
function JobChip({ label, url }: { label: string; url: string }) {
  const { number, name } = splitJobLinkLabel(label)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="checklist-job-chip"
      title={`Open job ${number ? `${number} · ` : ''}${name}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        maxWidth: '100%',
        padding: '0.05rem 0.5rem 0.05rem 0.2rem',
        border: '1px solid rgba(124, 58, 237, 0.35)',
        background: 'rgba(124, 58, 237, 0.08)',
        borderRadius: 999,
        color: 'var(--text)',
        textDecoration: 'none',
        fontSize: '0.8125rem',
        fontWeight: 600,
        lineHeight: 1.4,
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
      }}
    >
      {number ? (
        <span
          style={{
            padding: '0 0.35rem',
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.02em',
            borderRadius: 4,
            border: '1px solid var(--border-strong)',
            background: 'var(--bg-muted)',
            color: 'var(--text-700)',
            flexShrink: 0,
          }}
        >
          {number}
        </span>
      ) : null}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{name}</span>
      <span aria-hidden style={{ color: '#7c3aed', fontSize: '0.75rem', flexShrink: 0 }}>
        ↗
      </span>
    </a>
  )
}

/**
 * Renders checklist item title with [1], [2], etc. as clickable links.
 * links[0] maps to [1], links[1] to [2], etc.
 * Also supports {{1:Label}} for custom anchor text using the same link index;
 * when that link is a job door the label renders as the job chip (v2.3769).
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
    if (url != null && t.kind === 'named' && isJobDoorLink(url)) {
      parts.push(<JobChip key={key} label={t.label} url={url} />)
      // The doors store " — " after the job; the chip carries that meaning.
      lastIndex = t.end + dashAfterTokenLength(title.slice(t.end))
      // A space keeps the chip and the task apart when the dash is dropped.
      if (lastIndex < title.length && lastIndex > t.end) parts.push(' ')
      continue
    }
    if (url != null) {
      const anchorChildren =
        t.kind === 'named' ? t.label : `[${t.n}]`
      parts.push(
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--text-link)', textDecoration: 'underline' }}
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
