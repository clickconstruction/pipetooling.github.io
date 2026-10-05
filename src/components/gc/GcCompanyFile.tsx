import { useRef, useState, type ReactNode } from 'react'
import { shortDate, type ActivityKind, type CompanyDoc, type CompanyDocGroup, type CompanyEvent, type CompanyPaper, type DocStatus } from '../../lib/gcMode/gcModel'
import { useCompanyOpener, type CompanyTab } from './gcCompanyOpener'
import { Btn, input } from './gcUi'

/**
 * GC mode design spike: the company window's three tabs, shared by a trade's window and a
 * customer's (the owner, 2026-10-04; mock-up `to-dos/gc-mode/company-window-mockup.html`).
 * Activity is one timeline; Documents leads with what is missing and shows the paper beside the list.
 */

export function CompanyTabStrip({ tab, onTab, activity, toGet }: { tab: CompanyTab; onTab: (t: CompanyTab) => void; activity: number; toGet: number }) {
  const tabs: { key: CompanyTab; label: string }[] = [
    { key: 'about', label: 'About' },
    { key: 'activity', label: `Activity (${activity})` },
    { key: 'documents', label: toGet > 0 ? `Documents · ${toGet} to get` : 'Documents' },
  ]
  return (
    <div role="tablist" aria-label="Company" style={{ display: 'flex', gap: '0.25rem', padding: '0 1rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
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

const KIND_WORDS: { key: ActivityKind | 'all'; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'note', label: 'Calls and notes' },
  { key: 'quote', label: 'Quotes and bids' },
  { key: 'paper', label: 'Paperwork' },
  { key: 'money', label: 'Money' },
]

const KIND_DOT: Record<ActivityKind, string> = {
  note: 'var(--text-blue-500)',
  quote: 'var(--text-violet-700)',
  paper: 'var(--text-amber-700)',
  money: 'var(--text-green-700)',
}

/** One timeline, newest first, with filters, a link to each job, and a box to log a call. */
export function CompanyActivity({
  events,
  onOpenProject,
  onLog,
}: {
  events: CompanyEvent[]
  onOpenProject?: (projectId: string) => void
  onLog: (note: string) => void
}) {
  const [kind, setKind] = useState<ActivityKind | 'all'>('all')
  const [note, setNote] = useState('')
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
          <li key={`${e.on}-${i}`} style={{ display: 'grid', gridTemplateColumns: '5.5rem minmax(0, 1fr)', gap: '0.6rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
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
}: {
  groups: CompanyDocGroup[]
  selected: string | null
  onSelect: (key: string) => void
  paper: CompanyPaper | null
  ask?: (doc: CompanyDoc) => ReactNode
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
        <PaperView paper={paper} />
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
