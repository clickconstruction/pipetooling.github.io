/**
 * The stage calendar modal (v2.2963): opened from the dates link on Jobs →
 * Subs → Work. The months the window touches, Monday-first, weekends dimmed;
 * our window as a light fill, the sub's pick as a solid bar, the GC's ask as a
 * dashed ring, today outlined, the sub's days off hatched, the job's other
 * stages as thin marks. The side panel carries the facts and every move —
 * the same writes the board has. Looking happens on the calendar, acting on
 * the buttons; clicking a day does nothing.
 */
import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { stageWindowLabel, type StageWindowSpan } from '../../lib/subs/stageWindow'
import { calendarDays, calendarMonthTitle, calendarMonthsFor, workingDaysIn, type CalendarDay } from '../../lib/subs/stageCalendar'
import type { WindowGcState } from './WindowTextCell'

export type StageCalendarSibling = { key: string; name: string; subName: string | null; span: StageWindowSpan | null; pick: StageWindowSpan | null; current: boolean }

export type StageCalendarModalProps = {
  open: boolean
  onClose: () => void
  title: string
  subtitle: string | null
  todayYmd: string
  window: StageWindowSpan | null
  windowBy: 'office' | 'gc' | null
  pick: StageWindowSpan | null
  pickBy: 'sub' | 'office' | null
  ask: { span: StageWindowSpan; note: string | null; askedOn: string | null } | null
  gc: { state: WindowGcState; gcName: string | null; shownSince: string | null }
  subName: string | null
  /** The sub's status in one line — "offer out since Sep 4 · no pick yet", "signed Sep 3". */
  subLine: string | null
  offDays: readonly string[]
  siblings: readonly StageCalendarSibling[]
  onChange?: () => void
  onAccept?: () => void
  onAnswer?: () => void
  onOffer?: () => void
  onWithdraw?: () => void
  /** The propose-dates form when Answer… is open — rendered under the GC fact. */
  answerForm?: ReactNode
  busy?: boolean
}

const GREEN_SOLID = '#16a34a'
const AMBER_SOLID = '#d97706'
const TODAY_RING = '#b5651d'

const kStyle: CSSProperties = { fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, color: 'var(--text-muted)' }
const vStyle: CSSProperties = { fontSize: '0.82rem' }
const btn = (tone: 'ghost' | 'ok' | 'warn' | 'primary' | 'danger', disabled = false): CSSProperties => {
  const base: CSSProperties = { font: 'inherit', fontSize: '0.74rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', opacity: disabled ? 0.6 : 1 }
  if (tone === 'ok') return { ...base, background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)', color: 'var(--text-green-700)' }
  if (tone === 'warn') return { ...base, background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', color: 'var(--text-amber-800)' }
  if (tone === 'primary') return { ...base, background: '#2563eb', border: '1px solid transparent', color: 'white' }
  if (tone === 'danger') return { ...base, color: 'var(--text-red-700)' }
  return base
}

function dayStyle(d: CalendarDay): CSSProperties {
  const s: CSSProperties = { position: 'relative', height: 40, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums', padding: '3px 5px', color: 'var(--text-700)', boxSizing: 'border-box' }
  if (!d.inMonth) s.opacity = 0.35
  if (d.weekend) {
    s.background = 'var(--bg-subtle)'
    s.color = 'var(--text-faint)'
  }
  if (d.window) {
    s.background = d.passed ? 'var(--bg-subtle)' : 'var(--bg-green-tint)'
    s.borderColor = d.passed ? 'var(--border-strong)' : 'var(--border-green)'
    if (d.passed) s.color = 'var(--text-muted)'
  }
  if (d.off) {
    s.backgroundImage = 'repeating-linear-gradient(135deg, var(--border) 0 3px, transparent 3px 8px)'
    s.color = 'var(--text-muted)'
  }
  if (d.ask) {
    s.border = `1.5px dashed ${AMBER_SOLID}`
  }
  if (d.today) {
    s.outline = `2px solid ${TODAY_RING}`
    s.outlineOffset = -2
  }
  return s
}

function Month({ month, days }: { month: string; days: CalendarDay[] }) {
  return (
    <div>
      <h4 style={{ margin: '0 0 6px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-700)' }}>{calendarMonthTitle(month)}</h4>
      <div role="grid" aria-label={calendarMonthTitle(month)} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={`${d}-${i}`} aria-hidden="true" style={{ fontSize: '0.6rem', textAlign: 'center', color: 'var(--text-faint)', fontWeight: 700, letterSpacing: '0.06em', paddingBottom: 2 }}>
            {d}
          </div>
        ))}
        {days.map((d) => (
          <div key={d.ymd} role="gridcell" aria-label={`${d.ymd}${d.window ? ', in the window' : ''}${d.pick ? ', picked' : ''}${d.ask ? ', the GC asked' : ''}${d.off ? ', day off' : ''}${d.today ? ', today' : ''}`} style={dayStyle(d)}>
            <span style={{ color: d.today ? TODAY_RING : undefined, fontWeight: d.today ? 800 : undefined }}>{d.day}</span>
            {d.sibling ? <span aria-hidden="true" style={{ position: 'absolute', left: 4, right: 4, bottom: 13, height: d.siblingPick ? 4 : 3, borderRadius: 2, background: d.siblingPick ? GREEN_SOLID : 'var(--text-faint)', opacity: d.siblingPick ? 0.7 : 0.55 }} /> : null}
            {d.pick ? <span aria-hidden="true" style={{ position: 'absolute', left: 4, right: 4, bottom: 5, height: 6, borderRadius: 3, background: d.passed ? 'var(--text-faint)' : GREEN_SOLID }} /> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function Legend({ subName }: { subName: string | null }) {
  const sw = (style: CSSProperties) => <i style={{ display: 'inline-block', width: 12, height: 10, borderRadius: 3, verticalAlign: -1, marginRight: 4, ...style }} />
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 12 }}>
      <span>{sw({ background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)' })}our window</span>
      <span>{sw({ background: GREEN_SOLID, height: 6 })}the sub's pick</span>
      <span>{sw({ border: `1.5px dashed ${AMBER_SOLID}` })}what the GC asked</span>
      <span>{sw({ outline: `2px solid ${TODAY_RING}`, outlineOffset: -2 })}today</span>
      <span>{sw({ backgroundImage: 'repeating-linear-gradient(135deg, var(--border) 0 3px, transparent 3px 6px)', border: '1px solid var(--border)' })}{subName ? `${subName.split(/\s+/)[0]}'s day off` : 'day off'}</span>
      <span>{sw({ background: 'var(--text-faint)', height: 3, opacity: 0.55 })}other stages on this job</span>
    </div>
  )
}

export function StageCalendarModal(props: StageCalendarModalProps) {
  const { open, onClose, title, subtitle, todayYmd, window: win, windowBy, pick, pickBy, ask, gc, subName, subLine, offDays, siblings, onChange, onAccept, onAnswer, onOffer, onWithdraw, answerForm, busy = false } = props
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const months = calendarMonthsFor({ todayYmd, window: win, pick, ask: ask?.span ?? null })
  const sibSpans = siblings.filter((s) => !s.current && s.span).map((s) => s.span!)
  const sibPicks = siblings.filter((s) => !s.current && s.pick).map((s) => s.pick!)
  const gcName = gc.gcName?.trim() || 'the GC'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 56, overflowY: 'auto', padding: '2rem 1rem' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ width: 'min(920px, 100%)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px' }} className="stage-calendar-modal">
        <div style={{ padding: '16px 18px 18px', borderRight: '1px solid var(--border)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
              {subtitle ? <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{subtitle}</p> : null}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '1.05rem', cursor: 'pointer', lineHeight: 1 }}>
              ✕
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: months.length > 1 ? 'repeat(auto-fit, minmax(240px, 1fr))' : 'minmax(240px, 420px)', gap: 18 }}>
            {months.map((m) => (
              <Month key={m} month={m} days={calendarDays(m, { todayYmd, window: win, pick, ask: ask?.span ?? null, offDays, siblings: sibSpans, siblingPicks: sibPicks })} />
            ))}
          </div>
          <Legend subName={subName} />
        </div>
        <div style={{ padding: '16px 18px', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={kStyle}>Our window</span>
            <span style={vStyle}>{win ? <><b style={{ fontWeight: 600 }}>{stageWindowLabel(win)}</b> · {workingDaysIn(win)} working days · {windowBy === 'gc' ? `as ${gcName} asked` : 'set by the office'}</> : <span style={{ color: 'var(--text-muted)' }}>no window yet</span>}</span>
            {onChange ? (
              <div>
                <button type="button" style={btn('ghost', busy)} disabled={busy} onClick={onChange}>
                  {win ? 'Change our window…' : 'Set a window…'}
                </button>
              </div>
            ) : null}
          </div>
          {ask ? (
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={kStyle}>{gcName} asked</span>
              <span style={{ ...vStyle, color: 'var(--text-amber-800)', fontWeight: 600 }}>
                {stageWindowLabel(ask.span)}
                {ask.note ? ` · “${ask.note}”` : ''}
                {ask.askedOn ? ` · ${ask.askedOn}` : ''}
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" style={btn('ok', busy)} disabled={busy} onClick={onAccept}>
                  Accept {stageWindowLabel(ask.span)}
                </button>
                <button type="button" style={btn('warn', busy)} disabled={busy} onClick={onAnswer}>
                  Answer with…
                </button>
              </div>
              {answerForm}
            </div>
          ) : null}
          {gc.state !== 'none' ? (
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={kStyle}>{gc.state === 'off' ? 'GC portal' : `${gcName}'s portal`}</span>
              <span style={vStyle}>{gc.state === 'off' ? <span style={{ color: 'var(--text-muted)' }}>off for this job · Edit Job → GC/Builder → Share stage dates</span> : gc.state === 'offer' ? 'not shown yet' : gc.shownSince ? `shown since ${gc.shownSince}` : 'shown'}</span>
              {gc.state === 'offer' && onOffer ? (
                <div>
                  <button type="button" style={btn('primary', busy)} disabled={busy} onClick={onOffer}>
                    Offer to {gcName}
                  </button>
                </div>
              ) : null}
              {(gc.state === 'shown' || gc.state === 'asked') && onWithdraw ? (
                <div>
                  <button type="button" style={btn('ghost', busy)} disabled={busy} onClick={onWithdraw}>
                    Take it off their portal
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {subName ? (
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={kStyle}>{subName}</span>
              <span style={vStyle}>
                {subLine ?? '—'}
                {pick ? <> · picked <b style={{ fontWeight: 600 }}>{stageWindowLabel(pick)}</b>{pickBy === 'office' ? ' (office)' : ''}</> : null}
                {offDays.length > 0 ? <> · off <b style={{ fontWeight: 600 }}>{offDays.map((d) => d.slice(5).replace('-', '/')).join(', ')}</b></> : null}
              </span>
            </div>
          ) : null}
          {siblings.length > 0 ? (
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={kStyle}>Stages on this job</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.74rem' }}>
                {siblings.map((s) => (
                  <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: s.current ? 700 : 400, color: s.current ? 'var(--text-base)' : 'var(--text-700)' }}>
                    <span>
                      {s.name}
                      {s.subName ? ` · ${s.subName}` : ' · —'}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {s.span ? stageWindowLabel(s.span) : 'no window'}
                      {s.pick ? ` · picked ${stageWindowLabel(s.pick)}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" style={btn('primary')} onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StageCalendarModal
