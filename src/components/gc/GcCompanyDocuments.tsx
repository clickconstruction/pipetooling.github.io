import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ActivityKind, CompanyDoc, CompanyDocGroup, CompanyEvent, DocStatus } from '../../lib/gc/companyFile'
import { shortDate } from '../../lib/gc/words'
import type { CompanyTab } from './gcCompanyOpener'
import { Btn, input } from './gcUi'

/**
 * GC mode, the real build, the Board's B6-b-ii: the company window's tabs and its Documents list, from the design
 * spike's `GcCompanyFile.tsx` (`CompanyTabStrip`, `CompanyDocuments`). Documents leads with what is missing; a paper's
 * next step opens beside the list. The spike's made-up paper beside the list is left there: the real build shows the
 * send, or the certificate form, in its place. Since B2b-iv, Activity (`CompanyActivity`): everything with the company
 * in one timeline, and a box to log a call.
 */

export type { CompanyTab } from './gcCompanyOpener'

export function CompanyTabStrip({
  tab,
  onTab,
  activity,
  toGet,
  portal,
}: {
  tab: CompanyTab
  onTab: (t: CompanyTab) => void
  /** How many lines Activity holds. Unset: no Activity tab (the customer window's, until B2b-v). */
  activity?: number
  toGet: number
  portal: boolean
}) {
  const tabs: { key: CompanyTab; label: string }[] = [
    { key: 'about', label: 'About' },
    ...(activity === undefined ? [] : [{ key: 'activity' as const, label: `Activity (${activity})` }]),
    { key: 'documents', label: toGet > 0 ? `Documents · ${toGet} to get` : 'Documents' },
    ...(portal ? [{ key: 'portal' as const, label: 'Their portal' }] : []),
  ]
  const stripRef = useRef<HTMLDivElement | null>(null)
  // The picked tab stays in sight when the row scrolls on a phone.
  useEffect(() => {
    const strip = stripRef.current
    const on = strip?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!strip || !on) return
    const box = strip.getBoundingClientRect()
    const r = on.getBoundingClientRect()
    if (r.right > box.right) strip.scrollLeft += r.right - box.right
    else if (r.left < box.left) strip.scrollLeft -= box.left - r.left
  }, [tab])
  return (
    // One row that scrolls sideways on a phone, rather than rows of tabs.
    <div ref={stripRef} role="tablist" aria-label="Company" style={{ display: 'flex', gap: '0.25rem', padding: '0 1rem', borderBottom: '1px solid var(--border)', overflowX: 'auto', flex: 'none' }}>
      {tabs.map((t) => {
        const on = tab === t.key
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            data-gc-company-tab={t.key}
            onClick={() => onTab(t.key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${on ? 'var(--text-blue-500)' : 'transparent'}`,
              padding: '0.55rem 0.7rem',
              whiteSpace: 'nowrap',
              font: 'inherit',
              fontSize: '0.9rem',
              fontWeight: on ? 700 : 500,
              color: on ? 'var(--text-base)' : t.key === 'documents' && toGet > 0 ? 'var(--text-amber-800)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

const STATUS_STYLE: Record<DocStatus, { dot: string; fg: string }> = {
  ok: { dot: 'var(--text-green-700)', fg: 'var(--text-green-700)' },
  soon: { dot: 'var(--text-amber-700)', fg: 'var(--text-amber-800)' },
  missing: { dot: 'var(--text-red-700)', fg: 'var(--text-red-700)' },
  info: { dot: 'var(--text-muted)', fg: 'var(--text-muted)' },
}

/**
 * The papers, status first. `ask` draws a row's next step (a button, or why there is none yet); `aside` is what shows
 * beside the list: a send in progress or the certificate form. `selected` is the row it belongs to.
 */
export function CompanyDocuments({
  groups,
  selected,
  ask,
  aside,
}: {
  groups: CompanyDocGroup[]
  selected: string | null
  ask?: (doc: CompanyDoc) => ReactNode
  aside?: ReactNode
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1rem', alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: '0.9rem', minWidth: 0 }}>
        {groups.map((g) => (
          <section key={g.title} aria-label={g.title}>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{g.title}</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {g.docs.map((d, i) => {
                const on = d.key === selected
                const st = STATUS_STYLE[d.status]
                return (
                  <div
                    key={d.key}
                    data-gc-doc={d.key}
                    style={{ padding: '0.5rem 0.65rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', display: 'grid', gap: '0.15rem' }}
                  >
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: st.dot, flex: 'none' }} />
                      <strong style={{ fontWeight: 600 }}>{d.title}</strong>
                      <span style={{ color: st.fg, fontSize: '0.82rem', fontWeight: 600 }}>{d.statusWords}</span>
                      <span style={{ flex: 1 }} />
                      {ask?.(d)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.1rem' }}>
                      {d.meta}
                      {d.link && (
                        <>
                          {' '}
                          <a href={d.link.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)' }}>
                            {d.link.label}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <div style={{ minWidth: 0, position: 'sticky', top: 0 }}>
        {aside ?? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem', border: '1px dashed var(--border-strong)', borderRadius: 8 }}>
            A paper that is missing has its next step on its row.
          </div>
        )}
      </div>
    </div>
  )
}

const KIND_WORDS: { key: ActivityKind | 'all'; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'note', label: 'Calls and notes' },
  { key: 'quote', label: 'Quotes and bids' },
  { key: 'paper', label: 'Paperwork' },
  { key: 'money', label: 'Money' },
  { key: 'work', label: 'On the job' },
]

const KIND_DOT: Record<ActivityKind, string> = {
  note: 'var(--text-blue-500)',
  quote: 'var(--text-violet-700)',
  paper: 'var(--text-amber-700)',
  money: 'var(--text-green-700)',
  work: 'var(--text-red-700)',
}

const linkBtn = { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 } as const

/** How the office reached them: the call log's `how`. */
export type ContactHow = 'call' | 'text' | 'email'

/**
 * Activity (the Board's B2b-iv), from the design spike's `CompanyActivity`: one timeline, newest first, with filters,
 * a link to each job, and a box to log a contact. The real build's box asks how they were reached, as the call log
 * keeps it. `onLog` unset: no box.
 */
export function CompanyActivity({
  events,
  onOpenProject,
  onLog,
  focus,
}: {
  events: CompanyEvent[]
  onOpenProject?: (projectId: string) => void
  onLog?: (how: ContactHow, note: string) => Promise<void>
  /** The line it was opened at (a promise, say): lit and scrolled to. */
  focus?: string
}) {
  const [kind, setKind] = useState<ActivityKind | 'all'>('all')
  const [how, setHow] = useState<ContactHow>('call')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const lit = useRef<HTMLLIElement | null>(null)
  useEffect(() => {
    lit.current?.scrollIntoView({ block: 'center' })
  }, [focus])
  const shown = kind === 'all' ? events : events.filter((e) => e.kind === kind)
  const log = async () => {
    if (!onLog || note.trim() === '') return
    setBusy(true)
    setProblem(null)
    try {
      await onLog(how, note.trim())
      setNote('')
    } catch (e) {
      // The note stays in the box, to try again.
      setProblem(`The contact was not logged: ${e instanceof Error ? e.message : 'try again.'}`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {onLog && (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select value={how} onChange={(e) => setHow(e.target.value as ContactHow)} style={input} aria-label="How you reached them">
              <option value="call">Call</option>
              <option value="text">Text</option>
              <option value="email">Email</option>
            </select>
            <input style={{ ...input, flex: '1 1 18rem' }} placeholder="What was said, in a sentence" aria-label="What was said" value={note} onChange={(e) => setNote(e.target.value)} />
            <Btn kind="primary" disabled={busy || note.trim() === ''} onClick={() => void log()}>
              {busy ? 'Logging…' : 'Log a contact'}
            </Btn>
          </div>
          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
              {problem}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }} role="group" aria-label="Show">
        {KIND_WORDS.map((k) => {
          const on = kind === k.key
          const n = k.key === 'all' ? events.length : events.filter((e) => e.kind === k.key).length
          return (
            <button
              key={k.key}
              type="button"
              aria-pressed={on}
              onClick={() => setKind(k.key)}
              style={{
                padding: '0.2rem 0.65rem',
                borderRadius: 999,
                border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color: on ? 'var(--text-blue-500)' : 'var(--text-600)',
                fontWeight: on ? 600 : 400,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              {k.label} {n}
            </button>
          )
        })}
      </div>
      {shown.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nothing here yet.</div>}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.1rem' }}>
        {shown.map((e, i) => (
          <li
            key={`${e.on}-${i}`}
            ref={focus && e.id === focus ? lit : undefined}
            data-tour={focus && e.id === focus ? 'gc-activity-focus' : undefined}
            style={{
              display: 'grid',
              gridTemplateColumns: '5.5rem minmax(0, 1fr)',
              gap: '0.6rem',
              padding: '0.4rem 0.35rem',
              borderBottom: '1px solid var(--border)',
              ...(focus && e.id === focus ? { background: 'var(--bg-amber-tint)', borderRadius: 6, boxShadow: 'inset 3px 0 0 var(--text-amber-700)' } : {}),
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>{shortDate(e.on)}</span>
            <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', minWidth: 0 }}>
              <span aria-hidden style={{ flex: 'none', width: 8, height: 8, borderRadius: 999, background: KIND_DOT[e.kind], transform: 'translateY(-1px)' }} />
              <span style={{ minWidth: 0, fontSize: '0.9rem' }}>
                {e.text}
                {e.where && (
                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {e.projectId && onOpenProject ? (
                      <button type="button" onClick={() => onOpenProject(e.projectId ?? '')} style={linkBtn}>
                        {e.where}
                      </button>
                    ) : (
                      e.where
                    )}
                  </span>
                )}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
