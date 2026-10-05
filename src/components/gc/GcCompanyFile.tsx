import { useEffect, useRef, useState, type ReactNode } from 'react'
import { shortDate, type ActivityKind, type CompanyDoc, type CompanyDocGroup, type CompanyEvent, type CompanyPaper, type CompanyPortalStatus, type DocStatus, type PortalState } from '../../lib/gcMode/gcModel'
import { useCompanyOpener, type CompanyTab } from './gcCompanyOpener'
import { Btn, input } from './gcUi'

/**
 * GC mode design spike: the company window's three tabs, shared by a trade's window and a
 * customer's (the owner, 2026-10-04; mock-up `to-dos/gc-mode/company-window-mockup.html`).
 * Activity is one timeline; Documents leads with what is missing and shows the paper beside the list.
 */

export function CompanyTabStrip({
  tab,
  onTab,
  activity,
  toGet,
  portal,
}: {
  tab: CompanyTab
  onTab: (t: CompanyTab) => void
  activity: number
  toGet: number
  /** Their portal's status: the tab says it ("Their portal · active"). Unset: no portal tab (an architect). */
  portal?: CompanyPortalStatus
}) {
  const tabs: { key: CompanyTab; label: string }[] = [
    { key: 'about', label: 'About' },
    { key: 'activity', label: `Activity (${activity})` },
    { key: 'documents', label: toGet > 0 ? `Documents · ${toGet} to get` : 'Documents' },
    ...(portal ? [{ key: 'portal' as const, label: `Their portal · ${portal.word}` }] : []),
  ]
  const stripRef = useRef<HTMLDivElement | null>(null)
  // The picked tab stays in sight when the row scrolls on a phone (Their portal sits last).
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
    // One row that scrolls sideways on a phone, rather than three rows of tabs.
    <div ref={stripRef} role="tablist" aria-label="Company" style={{ display: 'flex', gap: '0.25rem', padding: '0 1rem', borderBottom: '1px solid var(--border)', overflowX: 'auto', flex: 'none' }}>
      {tabs.map((t) => {
        const on = tab === t.key
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            data-tour={`gc-company-tab-${t.key}`}
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
              color: on
                ? 'var(--text-base)'
                : (t.key === 'documents' && toGet > 0) || (t.key === 'portal' && portal?.state === 'waiting')
                  ? 'var(--text-amber-800)'
                  : t.key === 'portal' && portal?.state === 'active'
                    ? 'var(--text-green-700)'
                    : 'var(--text-muted)',
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

/** One timeline, newest first, with filters, a link to each job, and a box to log a call. */
export function CompanyActivity({
  events,
  onOpenProject,
  onLog,
  focus,
}: {
  events: CompanyEvent[]
  onOpenProject?: (projectId: string) => void
  onLog: (note: string) => void
  /** The line it was opened at (a promise, say): lit and scrolled to. */
  focus?: string
}) {
  const [kind, setKind] = useState<ActivityKind | 'all'>('all')
  const [note, setNote] = useState('')
  const lit = useRef<HTMLLIElement | null>(null)
  useEffect(() => {
    lit.current?.scrollIntoView({ block: 'center' })
  }, [focus])
  const shown = kind === 'all' ? events : events.filter((e) => e.kind === kind)
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          style={{ ...input, flex: '1 1 18rem' }}
          placeholder="What was said, in a sentence"
          aria-label="What was said"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Btn
          kind="primary"
          disabled={note.trim() === ''}
          onClick={() => {
            onLog(note.trim())
            setNote('')
          }}
        >
          Log a contact
        </Btn>
      </div>
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

const linkBtn = { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 } as const

const STATUS_STYLE: Record<DocStatus, { dot: string; fg: string }> = {
  ok: { dot: 'var(--text-green-700)', fg: 'var(--text-green-800)' },
  soon: { dot: 'var(--text-amber-700)', fg: 'var(--text-amber-800)' },
  missing: { dot: 'var(--text-red-700)', fg: 'var(--text-red-800)' },
  info: { dot: 'var(--text-muted)', fg: 'var(--text-600)' },
}

/**
 * The papers, status first, with the picked one showing beside the list. `ask` draws the button
 * for a paper that is missing or running out; it is left to the window, which knows who to ask.
 */
export function CompanyDocuments({
  groups,
  selected,
  onSelect,
  paper,
  ask,
  aside,
}: {
  groups: CompanyDocGroup[]
  selected: string | null
  onSelect: (key: string) => void
  paper: CompanyPaper | null
  ask?: (doc: CompanyDoc) => ReactNode
  /** Shown in the paper's place: a send in progress (the owner, 2026-10-04). */
  aside?: ReactNode
}) {
  const paperRef = useRef<HTMLDivElement | null>(null)
  // On a phone the paper sits under the list: bring it into view when one is picked.
  const pick = (key: string) => {
    onSelect(key)
    requestAnimationFrame(() => {
      const el = paperRef.current
      if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1rem', alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: '0.9rem', minWidth: 0 }}>
        {groups.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No papers yet.</div>}
        {groups.map((g) => (
          <section key={g.title}>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{g.title}</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {g.docs.map((d, i) => {
                const on = d.key === selected
                const st = STATUS_STYLE[d.status]
                return (
                  <div
                    key={d.key}
                    data-tour={`gc-doc-${d.key}`}
                    style={{
                      padding: '0.5rem 0.65rem',
                      borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                      background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      display: 'grid',
                      gap: '0.15rem',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: st.dot, flex: 'none' }} />
                      <button type="button" onClick={() => pick(d.key)} style={{ ...linkBtn, color: 'var(--text-base)', fontWeight: 600, textDecoration: on ? 'none' : 'underline', textDecorationColor: 'var(--border-strong)' }}>
                        {d.title}
                      </button>
                      <span style={{ color: st.fg, fontSize: '0.82rem', fontWeight: 600 }}>{d.statusWords}</span>
                      <span style={{ flex: 1 }} />
                      {on ? <span style={{ fontSize: '0.78rem', color: 'var(--text-blue-500)' }}>Showing</span> : null}
                      {ask?.(d)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.1rem' }}>{d.meta}</div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <div ref={paperRef} style={{ minWidth: 0, position: 'sticky', top: 0 }}>
        {aside ?? <PaperView paper={paper} />}
      </div>
    </div>
  )
}

/** A made-up paper, drawn light like a printed page in either theme. */
function PaperView({ paper }: { paper: CompanyPaper | null }) {
  if (!paper) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem', border: '1px dashed var(--border-strong)', borderRadius: 8 }}>Pick a paper to see it here.</div>
  }
  return (
    <div data-theme="light" data-tour="gc-doc-paper">
      <div style={{ background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.9rem 1rem', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.12)' }}>
        <div style={{ fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
          {paper.heading} · made-up
        </div>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(7rem, auto) minmax(0, 1fr)', gap: '0.35rem 0.8rem', fontSize: '0.86rem' }}>
          {paper.rows.map((r) => (
            <div key={r.label} style={{ display: 'contents' }}>
              <dt style={{ color: 'var(--text-muted)' }}>{r.label}</dt>
              <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{r.value}</dd>
            </div>
          ))}
        </dl>
        {paper.table && (
          <div style={{ overflowX: 'auto', marginTop: '0.7rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  {paper.table.head.map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border-strong)', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paper.table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} style={{ padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: '0.7rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{paper.foot}</div>
      </div>
    </div>
  )
}

/** A trade company's name that opens its window on About. Plain bold text where no window can open. */
export function PartnerName({ partnerId, company }: { partnerId: string; company: string }) {
  const opener = useCompanyOpener()
  if (!opener) return <strong>{company}</strong>
  return (
    <button
      type="button"
      onClick={() => opener.openPartner(partnerId, { tab: 'about' })}
      title={`Open ${company}: about them, everything that happened, and their papers`}
      data-tour={`gc-company-name-${partnerId}`}
      style={{ ...linkBtn, color: 'var(--text-base)', fontWeight: 700, textDecorationColor: 'var(--border-strong)' }}
    >
      {company}
    </button>
  )
}

const PORTAL_TONE: Record<PortalState, { bg: string; fg: string; label: string }> = {
  active: { bg: 'var(--bg-green-100)', fg: 'var(--text-green-800)', label: 'Active' },
  waiting: { bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)', label: 'Not opened yet' },
  off: { bg: 'var(--bg-muted)', fg: 'var(--text-600)', label: 'Off' },
  none: { bg: 'var(--bg-muted)', fg: 'var(--text-600)', label: 'No link yet' },
}

/**
 * *Their portal* (the owner, 2026-10-04): whether it is working, the link, and the portal itself as
 * they see it, beside it. `actions` are the window's own (turn a customer's on, say); `picker` picks
 * the job a customer's portal shows.
 */
export function CompanyPortalPanel({
  status,
  shows,
  actions,
  picker,
  preview,
}: {
  status: CompanyPortalStatus
  /** What the portal holds for them, in a sentence. */
  shows: string
  actions?: ReactNode
  picker?: ReactNode
  preview: ReactNode
}) {
  const tone = PORTAL_TONE[status.state]
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!status.link) return
    try {
      await navigator.clipboard.writeText(`https://${status.link}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* no clipboard here: the link is on screen to copy by hand */
    }
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1rem', alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: '0.75rem', minWidth: 0 }} data-tour="gc-company-portal-status">
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.85rem', display: 'grid', gap: '0.45rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ padding: '0.15rem 0.6rem', borderRadius: 999, background: tone.bg, color: tone.fg, fontWeight: 700, fontSize: '0.85rem' }}>
              {tone.label}
            </span>
            {status.late && <span style={{ color: 'var(--text-red-700)', fontSize: '0.8rem', fontWeight: 600 }}>longer than we give it</span>}
          </div>
          <div style={{ fontSize: '0.9rem' }}>{status.words}</div>
          {status.link && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Their link</span>
              <code style={{ background: 'var(--bg-subtle)', padding: '0.1rem 0.4rem', borderRadius: 4, overflowWrap: 'anywhere' }}>{status.link}</code>
              <Btn kind="quiet" onClick={() => void copy()}>
                {copied ? 'Copied' : 'Copy link'}
              </Btn>
            </div>
          )}
          {actions && <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>{actions}</div>}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{shows}</div>
        {picker}
      </div>
      <div style={{ minWidth: 0 }} data-tour="gc-company-portal-preview">
        {preview}
      </div>
    </div>
  )
}

/**
 * A company's name in a sentence or a table that opens its window (the owner, 2026-10-04: "from
 * any company's name"). `at` opens it on a tab, a paper or an Activity line. Plain where no window
 * can open.
 */
export function PartnerLink({
  partnerId,
  company,
  at,
  strong = false,
}: {
  partnerId: string
  company: string
  at?: { tab?: CompanyTab; doc?: string; focus?: string }
  strong?: boolean
}) {
  const opener = useCompanyOpener()
  if (!opener) return strong ? <strong>{company}</strong> : <>{company}</>
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        opener.openPartner(partnerId, at ?? { tab: 'about' })
      }}
      title={at?.focus ? `Open ${company} at this, on Activity` : `Open ${company}`}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        font: 'inherit',
        fontWeight: strong ? 700 : 'inherit',
        color: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
        textDecorationColor: 'var(--border-strong)',
        textUnderlineOffset: 3,
      }}
    >
      {company}
    </button>
  )
}
