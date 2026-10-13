import { useRef, useState } from 'react'
import type { ContactKind } from '../../../../lib/contacts/kernel'
import { QR_PRESS_COUNTED, qrEmpty, qrGroups, qrLineCount, qrMarks, qrStripCount, qrTotal, showNarrow, type QuickReply, type StepRef } from '../../../../lib/quickReplies/kernel'
import { input } from '../../gcUi'

const press = { border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface)', padding: '0.1rem 0.55rem', cursor: 'pointer', fontSize: '0.75rem' } as const
/** The pill for the group in view, lit as the prototype's `.gpills button.on`. */
const litPill = { background: 'var(--bg-blue-tint)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-700)' } as const

/** A line's words with the narrowed words lit, the way a highlight reads in a message's window. */
export function Marked({ text, needle }: { text: string; needle: string }) {
  return (
    <>
      {qrMarks(text, needle).map((p, i) =>
        p.lit ? (
          <mark key={i} style={{ background: 'var(--bg-yellow-200)', color: 'inherit', borderRadius: 2 }}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}

/**
 * Messages, cut 3's screens: the quick replies strip above the reply box (v1.142 to v1.145). Folded to one press until
 * opened; open, the groups as pills that scroll the lines to their group, the pill for the group in view lit as the
 * lines scroll (the prototype's `qrSpy`), the narrow box once the team has more than ten
 * lines, **Edit** (the quick replies editor) and *Find*, then each group's lines. A press on a line fills the box and nothing sends. The groups
 * and every word are `quickReplies/kernel.ts`'s.
 */
export function QuickRepliesStrip({
  kind,
  lines,
  me,
  nowStepId,
  steps,
  open,
  problem,
  onOpen,
  onUse,
  onFind,
  onEdit,
  onAdd,
}: {
  kind: ContactKind
  lines: readonly QuickReply[] | null
  me: string
  nowStepId: string | null
  steps: readonly StepRef[]
  open: boolean
  problem: string | null
  onOpen: (open: boolean) => void
  onUse: (q: QuickReply) => void
  onFind: () => void
  /** Opens the quick replies editor on its list. */
  onEdit: () => void
  /** Opens the editor on its add row, filled with the narrowed words. */
  onAdd: (words: string) => void
}) {
  const [filter, setFilter] = useState('')
  const [lit, setLit] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const groups = qrGroups(lines ?? [], { kind, nowStepId, steps, me, filter, place: 'strip' })
  const count = qrStripCount(groups, kind)

  if (!open) {
    return (
      <button
        type="button"
        data-qr-strip="folded"
        title="Quick replies. Opens the lines: a press on one fills the box, nothing sends. Your choice is kept on this computer."
        onClick={() => onOpen(true)}
        style={{ justifySelf: 'start', border: 'none', background: 'transparent', color: 'var(--text-600)', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}
      >
        Quick replies {lines ? <span style={{ color: 'var(--text-muted)' }}>· {count}</span> : null} ▸
      </button>
    )
  }

  const empty = qrEmpty(filter)
  const on = Math.min(lit, Math.max(groups.length - 1, 0))
  const jump = (i: number) => {
    setLit(i)
    const el = box.current?.querySelector(`[data-qr-group="${i}"]`) as HTMLElement | null
    if (el && box.current) box.current.scrollTo?.({ top: el.offsetTop - box.current.offsetTop, behavior: 'smooth' })
  }
  // The group whose head has reached the top of the box is the one in view; at the bottom, the last one is.
  const spy = () => {
    const el = box.current
    if (!el) return
    const heads = [...el.querySelectorAll<HTMLElement>('[data-qr-group]')]
    let cur = 0
    heads.forEach((h, i) => {
      if (h.offsetTop - el.offsetTop <= el.scrollTop + 6) cur = i
    })
    if (heads.length && el.scrollTop + el.clientHeight >= el.scrollHeight - 2) cur = heads.length - 1
    setLit(cur)
  }

  return (
    <div data-qr-strip="open" style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', display: 'grid', gap: '0.3rem', padding: '0.4rem 0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          title="Quick replies. Folds the lines away. Your choice is kept on this computer."
          onClick={() => onOpen(false)}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, padding: 0 }}
        >
          Quick replies ▾
        </button>
        {groups.map((g, i) => (
          <button
            key={g.key}
            type="button"
            data-qr-pill={i}
            aria-current={i === on ? 'true' : undefined}
            title={`${g.title}${g.tag ? ` · ${g.tag}` : ''}. Scrolls the lines to this group. ${qrLineCount(g.rows.length)}`}
            onClick={() => jump(i)}
            style={i === on ? { ...press, ...litPill } : press}
          >
            {g.title} <span style={{ color: 'var(--text-muted)' }}>{g.rows.length}</span>
          </button>
        ))}
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{count}</span>
        <span style={{ flex: 1 }} />
        {lines && showNarrow(lines, me) && (
          <input aria-label="Narrow the quick replies" placeholder="⌕ narrow" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...input, width: 140, padding: '0.15rem 0.4rem', fontSize: '0.78rem' }} />
        )}
        <button
          type="button"
          title="Edit quick replies. Opens every line with who it is for, its step, how often it is used and its history. Anyone can add or change a line. Every change is kept with who and when."
          onClick={onEdit}
          style={press}
        >
          Edit
        </button>
        <button type="button" title="Find a reply. Opens their last message, where they are in the flow, and every line with room to read." onClick={onFind} style={press}>
          ⤢ Find
        </button>
      </div>
      {problem && (
        <div role="alert" style={{ fontSize: '0.78rem', color: 'var(--text-red-700)' }}>
          {problem}
        </div>
      )}
      <div ref={box} data-qr-lines onScroll={spy} style={{ maxHeight: 132, overflowY: 'auto', display: 'grid', gap: '0.3rem' }}>
        {!lines && !problem && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Loading the quick replies…</div>}
        {lines && groups.length === 0 && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {empty.words}
            {empty.add && (
              <button type="button" onClick={() => onAdd(filter)} style={press}>
                {empty.add}
              </button>
            )}
          </div>
        )}
        {groups.map((g, i) => (
          <div key={g.key} data-qr-group={i} style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline', overflowX: 'auto' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-600)', whiteSpace: 'nowrap', flex: 'none' }}>
              {g.title}:{g.tag && <em style={{ color: 'var(--text-muted)' }}> {g.tag}</em>}
            </span>
            {g.rows.map((q) => (
              <button
                key={q.id}
                type="button"
                data-qr-line={q.id}
                title={`${q.scope === 'mine' ? 'Mine' : "The team's"} · used ${qrTotal(q)} time${qrTotal(q) === 1 ? '' : 's'}. Fills the box with this line. Nothing sends. ${QR_PRESS_COUNTED}`}
                onClick={() => onUse(q)}
                style={{ ...press, whiteSpace: 'nowrap', flex: 'none', borderStyle: q.scope === 'mine' ? 'dashed' : 'solid', fontSize: '0.78rem' }}
              >
                <Marked text={q.text} needle={filter} />
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
