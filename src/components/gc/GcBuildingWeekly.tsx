import { useEffect, useMemo, useState, type Dispatch } from 'react'
import { createPortal } from 'react-dom'
import {
  mondayOf,
  shortDate,
  weeklyReport,
  weeklyReportReady,
  weeklyReportSent,
  weeklyReportText,
  WEEKLY_SECTIONS,
  type GcAction,
  type GcProject,
  type GcState,
  type WeeklyChoice,
  type WeeklySectionKey,
} from '../../lib/gcMode/gcModel'
import { useAuth } from '../../hooks/useAuth'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { Btn, Card, Chip, input } from './gcUi'

/**
 * GC mode design spike: the weekly report to the customer (Building lane, the owner's go-ahead
 * 2026-10-05; mock-up artifact 7rjejsyWCFv523rrii7RCi). On the Daily log tab, a card for this
 * week's report: ready from Friday, or sent. Its window: what goes in, from me or the company,
 * short or full, a line of my own, who it goes to; the report as they will read it beside it.
 * Kernel: gcBuildingWeekly.ts.
 */

function useMeName(): string | null {
  try {
    return useAuth().profileName
  } catch {
    return null
  }
}

/** This week's report on the Daily log tab: ready, sent, or a draft to look at early. */
export function GcWeeklyReportCard({ state, project, dispatch }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction> }) {
  const [open, setOpen] = useState(false)
  if (project.stage !== 'building') return null
  const weekOf = mondayOf(state.today)
  const sent = weeklyReportSent(project, weekOf)
  const ready = weeklyReportReady(state, project)
  const customer = state.customers.find((c) => c.id === project.customerId)
  const who = customer?.contact || customer?.name || project.owner
  return (
    <Card style={{ border: ready ? '1px solid var(--border-blue)' : undefined }}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
        <strong>Weekly report · week of {shortDate(weekOf)}</strong>
        {sent ? (
          <Chip tone="green">sent {shortDate(sent.sentOn)}</Chip>
        ) : ready ? (
          <Chip tone="blue">ready to send</Chip>
        ) : (
          <Chip tone="grey">drafts Friday</Chip>
        )}
        <span style={{ color: 'var(--text-muted)' }}>
          {sent ? `To ${sent.to}. It is in their portal.` : ready ? `This week's update to ${who} is drafted from the logs. Read it and send it.` : `To ${who}, from this week's logs.`}
        </span>
        <span style={{ flex: 1 }} />
        <Btn kind={ready ? 'primary' : 'quiet'} onClick={() => setOpen(true)}>
          {sent ? 'Open it' : ready ? 'Weekly report' : 'See the draft'}
        </Btn>
      </div>
      {open && <GcWeeklyReportWindow state={state} project={project} dispatch={dispatch} onClose={() => setOpen(false)} />}
    </Card>
  )
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; words: string; off?: boolean; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'grid', gap: '0.2rem' }}>
      <span style={{ fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>{label}</span>
      <div role="group" aria-label={label} style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', width: 'max-content', maxWidth: '100%' }}>
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={value === o.v}
            disabled={o.off}
            title={o.title}
            onClick={() => onChange(o.v)}
            style={{
              border: 'none',
              padding: '0 0.7rem',
              height: 30,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: o.off ? 'not-allowed' : 'pointer',
              background: value === o.v ? 'var(--bg-blue-200)' : 'var(--surface)',
              color: value === o.v ? 'var(--text-blue-800)' : 'var(--text-muted)',
              opacity: o.off ? 0.5 : 1,
            }}
          >
            {o.words}
          </button>
        ))}
      </div>
    </div>
  )
}

export function GcWeeklyReportWindow({ state, project, dispatch, onClose }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction>; onClose: () => void }) {
  const me = useMeName()
  const phone = useMatchMedia('(max-width: 820px)')
  const weekOf = mondayOf(state.today)
  const [names, setNames] = useState(false)
  const [choice, setChoice] = useState<WeeklyChoice>({ from: me ? 'me' : 'company', length: 'full', off: [], mine: '' })
  const [copy, setCopy] = useState(false)
  const [edited, setEdited] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const report = useMemo(() => weeklyReport(state, project, weekOf, names), [state, project, weekOf, names])
  const text = weeklyReportText(report, project, choice, me)
  const body = edited ?? text.body
  const sent = weeklyReportSent(project, weekOf)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pick = (patch: Partial<WeeklyChoice>) => {
    setChoice((c) => ({ ...c, ...patch }))
    setEdited(null)
  }
  const send = () => {
    dispatch({ type: 'sendWeeklyReport', projectId: project.id, weekOf, from: choice.from, by: choice.from === 'me' && me ? me : 'Click Construction', copyArchitect: copy, subject: text.subject, body })
    setDone(true)
  }
  const fromMe = choice.from === 'me'
  const cc = copy && report.architect?.email ? `&cc=${encodeURIComponent(report.architect.email)}` : ''
  const mailto = `mailto:${report.to.email}?subject=${encodeURIComponent(text.subject)}${cc}&body=${encodeURIComponent(body)}`
  const label = { fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 } as const
  const on = report.sections.filter((s) => !choice.off.includes(s.key))

  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : '1rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Weekly report, ${project.name}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: phone ? '12px 12px 0 0' : 12,
          width: phone ? '100%' : 'min(1100px, 100%)',
          maxHeight: phone ? '94vh' : 'min(94vh, 820px)',
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr) auto',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0,0,0,0.22)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start', padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Weekly report · {project.name}</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              The week of {shortDate(weekOf)} · to {report.to.name}
              {report.customer ? ` at ${report.customer.name}` : ''}
            </div>
          </div>
          <Btn kind="quiet" onClick={onClose}>
            Close
          </Btn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '19rem minmax(0, 1fr)', minHeight: 0, overflow: phone ? 'auto' : 'hidden' }}>
          <aside style={{ background: 'var(--bg-subtle)', borderRight: phone ? 'none' : '1px solid var(--border)', borderBottom: phone ? '1px solid var(--border)' : 'none', padding: '0.85rem 1rem', display: 'grid', gap: '0.8rem', alignContent: 'start', overflow: 'auto' }}>
            {report.missing.length > 0 && (
              <div style={{ border: '1px solid var(--border-amber, var(--border-strong))', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '0.5rem 0.65rem', fontSize: '0.82rem' }}>
                <strong>
                  No daily log for {report.missing.map((d) => shortDate(d)).join(' and ')}.
                </strong>{' '}
                The report skips {report.missing.length === 1 ? 'that day' : 'those days'}. Add the log first and it fills in.
              </div>
            )}
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <span style={label}>What goes in</span>
              {WEEKLY_SECTIONS.filter((s) => report.sections.some((x) => x.key === s.key)).map((s) => (
                <label key={s.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.86rem' }}>
                  <input
                    type="checkbox"
                    checked={!choice.off.includes(s.key)}
                    onChange={(e) => pick({ off: e.target.checked ? choice.off.filter((k) => k !== s.key) : [...choice.off, s.key as WeeklySectionKey] })}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    {s.title}
                    {report.hints[s.key] && <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.76rem' }}>{report.hints[s.key]}</span>}
                  </span>
                </label>
              ))}
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.86rem' }}>
                <input type="checkbox" checked={names} onChange={(e) => { setNames(e.target.checked); setEdited(null) }} style={{ marginTop: 3 }} />
                <span>
                  Name the companies
                  <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.76rem' }}>Off: their trade, "Electrical"</span>
                </span>
              </label>
            </div>
            <Seg
              label="From"
              value={choice.from}
              onChange={(v) => pick({ from: v })}
              options={[
                { v: 'me', words: me ? `Me · ${me}` : 'Me', off: !me, title: me ? undefined : 'Sign in to send in your name.' },
                { v: 'company', words: 'Click Construction' },
              ]}
            />
            <Seg
              label="Length"
              value={choice.length}
              onChange={(v) => pick({ length: v })}
              options={[
                { v: 'short', words: 'Short' },
                { v: 'full', words: 'Full' },
              ]}
            />
            <label style={{ display: 'grid', gap: '0.2rem' }}>
              <span style={label}>A line of your own</span>
              <textarea
                value={choice.mine}
                onChange={(e) => pick({ mine: e.target.value })}
                placeholder="Anything they should hear from you"
                rows={3}
                style={{ ...input, width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.55rem', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </label>
            <div style={{ display: 'grid', gap: '0.2rem', fontSize: '0.84rem' }}>
              <span style={label}>Goes to</span>
              <span>
                {report.to.name}
                {report.to.email ? ` · ${report.to.email}` : ''}
              </span>
              {report.architect && (
                <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
                  Copy {report.architect.name}
                </label>
              )}
            </div>
          </aside>

          <section aria-label={`The report as ${report.to.first} reads it`} style={{ padding: '1rem', overflow: 'auto', minWidth: 0, background: 'var(--bg-subtle)', display: 'grid', gap: '0.5rem', alignContent: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn kind="quiet" onClick={() => setEdited(edited === null ? body : null)}>
                {edited === null ? 'Edit the text' : 'Back to the draft'}
              </Btn>
            </div>
            {edited !== null ? (
              <textarea
                value={edited}
                onChange={(e) => setEdited(e.target.value)}
                aria-label="The report's text"
                rows={22}
                style={{ ...input, width: '100%', boxSizing: 'border-box', padding: '0.7rem 0.8rem', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9rem' }}
              />
            ) : (
              <article data-theme="light" style={{ maxWidth: 640, width: '100%', margin: '0 auto', background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 6, padding: phone ? '1rem' : '1.4rem 1.6rem', display: 'grid', gap: '0.75rem', lineHeight: 1.6, fontSize: '0.95rem' }}>
                <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{text.subject}</div>
                {body.split('\n\n').map((para, i) => {
                  const section = on.find((s) => para.startsWith(`${s.title}\n`))
                  if (section) {
                    return (
                      <div key={i} style={{ display: 'grid', gap: '0.25rem' }}>
                        <div style={{ fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>{section.title}</div>
                        <ul style={{ margin: 0, paddingLeft: '1.1em', display: 'grid', gap: '0.2rem' }}>
                          {section.lines.map((l, j) => (
                            <li key={j}>{l}</li>
                          ))}
                        </ul>
                      </div>
                    )
                  }
                  if (para.startsWith('- ')) {
                    return (
                      <ul key={i} style={{ margin: 0, paddingLeft: '1.1em', display: 'grid', gap: '0.2rem' }}>
                        {para.split('\n').map((l, j) => (
                          <li key={j}>{l.replace(/^- /, '')}</li>
                        ))}
                      </ul>
                    )
                  }
                  return (
                    <p key={i} style={{ margin: 0, whiteSpace: 'pre-line' }}>
                      {para}
                    </p>
                  )
                })}
              </article>
            )}
          </section>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', padding: '0.7rem 1.1rem', borderTop: '1px solid var(--border)' }}>
          <span style={{ color: done ? 'var(--text-green-800)' : 'var(--text-muted)', fontSize: '0.8rem', maxWidth: '58ch', fontWeight: done ? 600 : 400 }}>
            {done
              ? `Sent to ${report.to.first}. It is in their portal, and logged on ${report.customer?.name ?? 'their record'}.`
              : sent
                ? `Sent ${shortDate(sent.sentOn)}. Sending again replaces it in their portal.`
                : fromMe
                  ? 'Opens your email with this filled in, under your name, so replies come to you. It goes in their portal too. It never goes out on its own.'
                  : 'Goes from Click Construction and into their portal. In the prototype nothing leaves the app. It never goes out on its own.'}
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {fromMe && report.to.email ? (
              <a
                href={mailto}
                onClick={(e) => {
                  if (body.trim() === '') {
                    e.preventDefault()
                    return
                  }
                  send()
                }}
                style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 0.85rem', borderRadius: 6, background: '#2563eb', color: '#ffffff', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}
              >
                Send to {report.to.first}
              </a>
            ) : (
              <Btn kind="primary" disabled={body.trim() === ''} onClick={send}>
                Send to {report.to.first}
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** The weekly reports in the customer's portal, newest first, each opening to the text as sent. */
export function GcWeeklyReportsForCustomer({ project }: { project: GcProject }) {
  const reports = [...(project.weeklyReports ?? [])].sort((a, b) => (a.weekOf < b.weekOf ? 1 : -1))
  const [open, setOpen] = useState<string | null>(reports[0]?.weekOf ?? null)
  if (reports.length === 0) return null
  return (
    <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.875rem' }}>
      {reports.map((r, i) => (
        <div key={r.weekOf} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', paddingTop: i === 0 ? 0 : '0.4rem' }}>
          <button
            type="button"
            onClick={() => setOpen(open === r.weekOf ? null : r.weekOf)}
            aria-expanded={open === r.weekOf}
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}
          >
            <strong>Week of {shortDate(r.weekOf)}</strong>
            <span style={{ color: 'var(--text-muted)' }}>
              sent {shortDate(r.sentOn)} by {r.by}
            </span>
          </button>
          {open === r.weekOf && <div style={{ whiteSpace: 'pre-line', marginTop: '0.4rem', lineHeight: 1.55 }}>{r.body}</div>}
        </div>
      ))}
    </div>
  )
}
