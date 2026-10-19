import { useEffect } from 'react'
import type { PortalLang } from '../../../../lib/gc/portalI18n'
import type { BlankFills } from '../../../../lib/quickReplies/blanks'
import type { QuickReply, StepRef } from '../../../../lib/quickReplies/kernel'
import { paperRowWords, type Paper } from '../../../../lib/messages/papers'
import { SLASH_KEYS, SLASH_NONE, SLASH_READING } from '../../../../lib/quickReplies/slash'
import { lineWords } from '../../../../lib/quickReplies/spanish'
import { FilledLine } from './FilledLine'

/** The row for the line ↑ ↓ are on: the strip's lit pill. */
const LIT = { background: 'var(--bg-blue-tint)', boxShadow: 'inset 3px 0 0 var(--border-blue)' } as const

/**
 * Quick replies by keyboard (punch list #126): the list a `/` in the reply box opens, drawn above the box so a phone's
 * keyboard never covers it. Each row is the line as it would go (`FilledLine`), the typed words lit, its `/` shortcut
 * at the left when it has one (#126 C), the step it sits on at the right. The box keeps the focus: a press on a row
 * picks it without taking the caret away (`onMouseDown`), and the keys are the box's own (`ReplyBox`). Every word is
 * `quickReplies/slash.ts`'s.
 *
 * Punch list #127: when the words call a customer's papers (`/bill`, `/estimate`), the papers follow the lines under
 * their own title, the job's first; ↑ ↓ move through both, the lines first, and a press on a paper picks it.
 */
export function SlashList({
  id,
  rows,
  active,
  words,
  fills,
  fillsFor,
  lang,
  steps,
  head,
  reading,
  problem,
  papers = [],
  papersTitle = '',
  onPick,
  onPickPaper,
  onHover,
}: {
  /** The listbox's id, which the box names in `aria-controls`; row `i` is `${id}-${i}`. */
  id: string
  rows: readonly QuickReply[]
  active: number
  words: string
  fills: BlankFills
  /** #127: a line's own fills when they differ from the box's (a line that holds `{estimate}` speaks of an estimate). */
  fillsFor?: (q: QuickReply) => BlankFills
  lang: PortalLang
  steps: readonly StepRef[]
  head: { title: string; count: string }
  /** The lines are not read yet. */
  reading: boolean
  problem: string | null
  /** #127: the customer's papers the words call, after the lines; row `rows.length + j` is paper `j`. */
  papers?: readonly Paper[]
  papersTitle?: string
  onPick: (q: QuickReply) => void
  onPickPaper?: (p: Paper) => void
  onHover: (i: number) => void
}) {
  useEffect(() => {
    // jsdom has no scrollIntoView; a browser keeps the lit row in view as ↑ ↓ move.
    document.getElementById(`${id}-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [id, active])

  return (
    <div
      data-slash-list
      style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', boxShadow: '0 8px 22px -8px rgba(15, 23, 42, 0.35)', overflow: 'hidden', fontSize: '0.82rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.3rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
        <span>{head.title}</span>
        {!reading && !problem && <span data-slash-count>{head.count}</span>}
      </div>
      {reading ? (
        <div role="status" style={{ padding: '0.45rem 0.6rem', color: 'var(--text-muted)' }}>
          {SLASH_READING}
        </div>
      ) : problem ? (
        <div role="alert" style={{ padding: '0.45rem 0.6rem', color: 'var(--text-red-700)' }}>
          {problem}
        </div>
      ) : rows.length === 0 && papers.length === 0 ? (
        <div data-slash-none style={{ padding: '0.45rem 0.6rem', color: 'var(--text-muted)' }}>
          {SLASH_NONE}
        </div>
      ) : (
        <ul role="listbox" id={id} aria-label="Quick replies" style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '13rem', overflowY: 'auto' }}>
          {rows.map((q, i) => {
            const step = q.stepId ? steps.find((s) => s.id === q.stepId)?.name : null
            return (
              <li
                key={q.id}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
                data-slash-line={q.id}
                onMouseDown={(e) => {
                  // The box keeps the focus and the caret; the pick happens here.
                  e.preventDefault()
                  onPick(q)
                }}
                onMouseEnter={() => onHover(i)}
                style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', ...(i === active ? LIT : null) }}
              >
                {q.shortcut && (
                  <span data-slash-shortcut style={{ flex: 'none', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-blue-700)' }}>
                    /{q.shortcut}
                  </span>
                )}
                <span style={{ flex: 1, minWidth: 0, color: 'var(--text-700)', overflowWrap: 'anywhere' }}>
                  <FilledLine text={lineWords(q, lang)} fills={fillsFor ? fillsFor(q) : fills} needle={words} />
                </span>
                {step && <span style={{ flex: 'none', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{step}</span>}
              </li>
            )
          })}
          {papers.length > 0 && (
            <li role="presentation" data-slash-papers style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
              {papersTitle}
            </li>
          )}
          {papers.map((p, j) => {
            const i = rows.length + j
            const w = paperRowWords(p)
            return (
              <li
                key={`paper-${p.id}`}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
                data-slash-paper={p.id}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onPickPaper?.(p)
                }}
                onMouseEnter={() => onHover(i)}
                style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.1rem 0.6rem', alignItems: 'baseline', padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', ...(i === active ? LIT : null) }}
              >
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.78rem', fontWeight: 700 }}>{w.number}</span>
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  {w.what}
                  <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{w.when}</span>
                </span>
                <span style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {w.money}
                  <span data-slash-paper-state style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: w.tone === 'open' || w.tone === 'sent' ? 'var(--text-amber-800)' : 'var(--text-green-700)' }}>
                    {w.state}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <div aria-hidden="true" style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', padding: '0.25rem 0.6rem', fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        {SLASH_KEYS.map((k) => (
          <span key={k}>{k}</span>
        ))}
      </div>
    </div>
  )
}
