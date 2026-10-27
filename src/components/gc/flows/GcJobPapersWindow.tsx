import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useJobPapers } from '../../../hooks/useJobPapers'
import { companyAtForStep, customerAtForStep } from '../../../lib/flows/boardOpen'
import type { FlowKind } from '../../../lib/flows/facts'
import { jobPaperGrid, jobStrip, type CellMark, type CellPress, type JobPaperPill, type PillKey, type StripJob, type StripLine, type StripPress } from '../../../lib/flows/jobPapers'
import { jobPaperList } from '../../../lib/flows/jobPaperList'
import { flat } from '../../../lib/flows/state'
import { weekdayDate } from '../../../lib/gc/words'
import { useCompanyOpener } from '../gcCompanyOpener'
import { useCustomerOpener } from '../gcCustomerOpener'
import { EmptyState } from '../../EmptyState'

/**
 * Papers on this job (Messages cut 4, the prototype's v1.176, `job-papers-mockups.html` B), opened from a project's card
 * at `?papers=<projectId>`: the counts in the title as pills that filter, the strip before the job's day, a row per company
 * and a column per paper with a dot per cell, and List behind a tab. The words and rules are `flows/jobPapers.ts`'s and
 * `jobPaperList.ts`'s. A press opens the person's own window at the paper until the thread window does.
 */

const DOT: Record<CellMark, CSSProperties> = {
  done: { background: 'var(--text-green-700)' },
  waiting: { background: 'var(--surface)', border: '2px solid var(--border-400)' },
  none: { background: 'var(--border-400)' },
  late: { background: 'var(--text-orange-700)' },
  soon: { background: 'var(--text-orange-700)' },
  lapsed: { background: 'var(--text-red-700)' },
  later: { background: 'none', border: '1px dashed var(--border-strong)' },
}

const PILL: Record<JobPaperPill['tone'], CSSProperties> = {
  bad: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
  warn: { background: 'var(--bg-orange-tint)', color: 'var(--text-orange-700)' },
  ok: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  '': { background: 'var(--bg-muted)', color: 'var(--text-600)' },
}

const STRIP_DOT: Record<StripLine['tone'], string> = { r: 'var(--text-red-700)', o: 'var(--text-orange-700)', g: 'var(--border-400)' }

const PRESS_WORDS: Record<Exclude<CellPress, null>, string> = { open: 'Open', ask: 'Ask for it', send: 'Send it', remind: 'Remind them' }

const smallBtn: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 8, padding: '0.2rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', font: 'inherit', color: 'inherit', whiteSpace: 'nowrap' }

const LEGEND: [CellMark, string][] = [
  ['done', 'done, with its day'],
  ['waiting', 'waiting on them'],
  ['none', 'none yet'],
  ['late', 'late, or runs out soon'],
  ['lapsed', 'lapsed'],
  ['later', 'not yet on this job'],
]

export function GcJobPapersWindow({
  projectId,
  project,
  onClose,
  onOpenProject,
}: {
  projectId: string
  project: { name: string; stage: string; bidDue: string | null; ourBidSentOn: string | null }
  onClose: () => void
  /** Open the compare: the project's card, where Compare quotes is. */
  onOpenProject: (projectId: string) => void
}) {
  const papers = useJobPapers(projectId)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState<PillKey | null>(null)
  const companyOpener = useCompanyOpener()
  const customerOpener = useCustomerOpener()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const input = papers.input
  const grid = input ? jobPaperGrid(input, filter) : null
  const job: StripJob = project.stage === 'pursuing' ? { kind: 'bid', due: project.bidDue, sent: !!project.ourBidSentOn } : { kind: 'project' }
  const strip = input ? jobStrip(input, job) : null
  const kindOf = (contactId: string): FlowKind | null => input?.companies.find((c) => c.contactId === contactId)?.kind ?? null

  /** A person's own window at a step's paper, with its send open for anything but Open. */
  const openAt = (contactId: string, stepId: string | null, send: boolean) => {
    const kind = kindOf(contactId)
    const flow = kind && input ? input.flows[kind] : undefined
    const step = stepId && flow ? (flat(flow).find((s) => s.id === stepId) ?? null) : null
    const ref = papers.refs[contactId]
    if (kind === 'trade' && ref?.companyId) companyOpener?.openPartner(ref.companyId, companyAtForStep(step, send))
    else if (ref?.customerId) customerOpener?.openCustomer(ref.customerId, customerAtForStep(step, projectId, send))
  }
  const onStripPress = (p: StripPress) => {
    if (p.kind === 'compare') {
      onClose()
      onOpenProject(projectId)
    } else if (p.kind === 'ask' || p.kind === 'remind') openAt(p.contactId, p.stepId, true)
    else if (p.kind === 'remind-many' && p.contactIds[0]) openAt(p.contactIds[0], p.stepId, true)
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Papers on ${project.name}`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(1100px, 100%)', maxHeight: 'min(92vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '1.05rem' }}>Papers on this job</strong>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{project.name}</span>
          {grid?.pills.map((p) => (
            <button
              key={p.words}
              type="button"
              aria-pressed={!!p.key && filter === p.key}
              disabled={!p.key}
              onClick={() => p.key && setFilter(filter === p.key ? null : p.key)}
              style={{ ...PILL[p.tone], border: 'none', borderRadius: 999, padding: '0.1rem 0.6rem', fontSize: '0.78rem', fontWeight: 600, cursor: p.key ? 'pointer' : 'default', outline: p.key && filter === p.key ? '2px solid currentColor' : 'none', font: 'inherit' }}
            >
              {p.words}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <span role="group" aria-label="Grid or list" style={{ display: 'inline-flex', gap: 4 }}>
            {(['grid', 'list'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} style={{ ...smallBtn, ...(view === v ? { border: '1px solid var(--text-blue-500)', color: 'var(--text-blue-500)', background: 'var(--bg-blue-tint)' } : {}) }}>
                {v === 'grid' ? 'Grid' : 'List'}
              </button>
            ))}
          </span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '1rem', overflowY: 'auto', minHeight: 0, display: 'grid', gap: '0.75rem' }}>
          {papers.error ? (
            <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
              {papers.error}
            </div>
          ) : !input || !grid ? (
            <div style={{ fontSize: '0.875rem' }}>Reading the papers…</div>
          ) : (
            <>
              {strip && (
                <section aria-label={strip.title} style={{ border: '1px solid var(--border-orange)', background: 'var(--bg-orange-tint)', borderRadius: 10, padding: '0.6rem 0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-orange-700)', marginBottom: 4 }}>
                    {strip.title} · {weekdayDate(strip.day)} · {strip.daysLeft === 0 ? 'today' : `${strip.daysLeft} ${strip.daysLeft === 1 ? 'day' : 'days'}`}
                  </div>
                  {strip.lines.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.2rem 0', fontSize: '0.875rem' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: STRIP_DOT[l.tone] }} />
                      <span style={{ flex: 1 }}>{l.text}</span>
                      {l.press.kind !== 'gate' && (
                        <button type="button" style={smallBtn} onClick={() => onStripPress(l.press)}>
                          {l.press.kind === 'ask' ? 'Ask for it' : l.press.kind === 'compare' ? 'Open the compare' : l.press.label}
                        </button>
                      )}
                    </div>
                  ))}
                </section>
              )}
              {view === 'grid' ? (
                grid.sections.length ? (
                  <>
                    {grid.sections.map((s) => (
                      <table key={s.kind} style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', padding: '0.4rem 0.25rem', borderBottom: '1px solid var(--border)' }}>{s.title}</th>
                            {s.columns.map((c) => (
                              <th key={c.paper} style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', padding: '0.4rem 0.25rem', borderBottom: '1px solid var(--border)' }}>
                                {c.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {s.rows.map((r) => (
                            <tr key={r.contactId} data-papers-row={r.contactId}>
                              <td style={{ padding: '0.45rem 0.25rem', borderBottom: '1px solid var(--border)' }}>
                                <b>{r.name}</b>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.sub}</div>
                              </td>
                              {r.cells.map((cell) => (
                                <td key={cell.paper} style={{ textAlign: 'center', padding: '0.45rem 0.25rem', borderBottom: '1px solid var(--border)', opacity: cell.dim ? 0.3 : 1 }}>
                                  <button
                                    type="button"
                                    disabled={!cell.press}
                                    title={`${r.name}: ${cell.tip}`}
                                    aria-label={`${r.name}, ${s.columns.find((c) => c.paper === cell.paper)?.label ?? cell.paper}: ${cell.words || cell.tip}`}
                                    onClick={() => cell.press && openAt(r.contactId, cell.stepId, cell.press !== 'open')}
                                    style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2, border: 'none', background: 'none', cursor: cell.press ? 'pointer' : 'default', font: 'inherit', fontSize: '0.72rem', color: 'var(--text-muted)' }}
                                  >
                                    <span style={{ width: 14, height: 14, borderRadius: '50%', boxSizing: 'border-box', display: 'inline-block', ...DOT[cell.mark] }} />
                                    {cell.words}
                                  </button>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ))}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {LEGEND.map(([m, words]) => (
                        <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', boxSizing: 'border-box', display: 'inline-block', ...DOT[m] }} />
                          {words}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState compact main="Nobody on this job has papers yet." />
                )
              ) : (
                jobPaperList(input).map((c) => (
                  <div key={c.contactId} data-papers-list={c.contactId} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ background: 'var(--bg-muted)', padding: '0.4rem 0.6rem', fontWeight: 600, fontSize: '0.85rem' }}>
                      {c.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {c.kindWord}</span>
                    </div>
                    {c.lines.map((l) => (
                      <div key={l.paper} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.4rem 0.6rem', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }}>
                        <span style={{ flex: '1 1 160px' }}>{l.label}</span>
                        <span style={{ flex: '1 1 160px', color: l.tone === 'ok' ? 'var(--text-green-700)' : l.tone === 'bad' ? 'var(--text-red-700)' : l.tone === 'warn' ? 'var(--text-orange-700)' : 'var(--text-muted)' }}>{l.state}</span>
                        <span style={{ flex: '1 1 180px', color: 'var(--text-600)' }}>
                          {l.step} · {l.where}
                        </span>
                        {l.press && (
                          <button type="button" style={smallBtn} onClick={() => openAt(c.contactId, input.companies.find((x) => x.contactId === c.contactId)?.reads[l.paper]?.stepId ?? null, l.press !== 'open')}>
                            {PRESS_WORDS[l.press]}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
