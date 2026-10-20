/**
 * GC mode, the schedule's PR 15b: the customer's schedule in their portal (G-90 to G-93), ported from the GC mode
 * prototype (branch spike/gc-mode, `GcCustomerSchedule.tsx`) with its words; the plan is
 * to-dos/gc-mode/mockups/schedule-pr15b.md on that branch. It opens each GC job being built (call 7) and draws
 * `customer-portal`'s answer, never a state: the finish against their contract, the work done, the next date to meet,
 * each stage as one bar on one axis with Today, the dates to meet, every bar for a GC or an owner's rep, then what
 * changed this week and what we need from them. No company, no dollar and no spare day reach it (call 2).
 * Customer-facing, so single-theme light on the portal's paper.
 */
import { useState } from 'react'
import type { PortalGcSchedule as Schedule } from '../../lib/portal/portalPayload'
import { CUSTOMER_NOTHING_MOVED } from '../../lib/gc/schedule/customerSchedule'
import { daysBetween } from '../../lib/gc/schedule/network'
import { shortDate, weekdayDate } from '../../lib/gc/words'
import { FAINT, HAIR, INK, MUTED, PAPER_GREEN, PAPER_RED } from '../../lib/portal/portalTheme'

/** Saturated on purpose: the same status colors as the office's chart. */
const C = { blue: '#3b82f6', green: '#16a34a', red: '#dc2626', amber: '#d97706' }
const TONE: Record<Schedule['groups'][number]['bars'][number]['tone'], string> = { green: PAPER_GREEN, red: PAPER_RED, amber: '#b45309', blue: '#1d4ed8', grey: MUTED }

export function PortalGcSchedule({ schedule }: { schedule: Schedule }) {
  const [everyBar, setEveryBar] = useState(false)
  const { stages, dates } = schedule
  if (stages.length === 0) return null
  const first = stages.reduce((a, s) => (s.start < a ? s.start : a), stages[0]!.start)
  const last = [schedule.finish ?? '', ...stages.map((s) => s.finish), ...dates.map((d) => d.due)].reduce((a, b) => (b > a ? b : a), '')
  const days = Math.max(1, daysBetween(first, last) + 1)
  const x = (on: string) => `${(daysBetween(first, on) / days) * 100}%`
  const w = (start: string, finish: string) => `${((daysBetween(start, finish) + 1) / days) * 100}%`
  const next = schedule.next
  const stat = (label: string, value: string, sub: string, red?: boolean) => (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: red ? PAPER_RED : INK }}>{value}</div>
      <div style={{ fontSize: 12, color: MUTED }}>{sub}</div>
    </div>
  )
  return (
    <div data-testid="portal-gc-schedule" style={{ display: 'grid', gap: 10, color: INK }}>
      <div style={{ fontWeight: 700 }}>Your schedule</div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {stat('We finish', schedule.finish ? weekdayDate(schedule.finish) : 'Not drawn yet', schedule.contract ? `your contract says ${shortDate(schedule.contract)}` : '', schedule.late > 0)}
        {stat('Work done', `${schedule.donePct}%`, `we planned ${schedule.plannedPct}% by today`)}
        {next && stat('Next for you', next.label, next.state === 'late' ? `${weekdayDate(next.due)}, ${next.daysLate} days late` : weekdayDate(next.due), next.state === 'late')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(7rem, 12rem) minmax(0, 1fr)', gap: '4px 10px', alignItems: 'center' }}>
        {stages.map((s) => {
          const color = s.state === 'done' ? C.green : s.state === 'behind' ? C.amber : C.blue
          return (
            <div key={`${s.label}:${s.start}`} data-portal-gc-stage style={{ display: 'contents' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, minWidth: 0 }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                <span style={{ color: s.state === 'behind' ? '#b45309' : MUTED, fontVariantNumeric: 'tabular-nums' }}>{s.pct}%</span>
              </div>
              <div style={{ position: 'relative', height: 16 }} title={`${s.label}: ${shortDate(s.start)} to ${shortDate(s.finish)}, ${s.pct}% done`}>
                <span style={{ position: 'absolute', left: x(s.start), width: w(s.start, s.finish), top: 1, height: 14, borderRadius: 4, boxSizing: 'border-box', border: `1.5px solid ${color}`, background: s.state === 'done' ? 'var(--bg-green-100)' : 'var(--bg-blue-tint)', overflow: 'hidden' }}>
                  {s.pct > 0 && s.state !== 'done' && <span style={{ display: 'block', height: '100%', width: `${Math.min(100, s.pct)}%`, background: color, opacity: 0.7 }} />}
                </span>
              </div>
            </div>
          )
        })}
        <div style={{ color: MUTED }}>Dates to meet</div>
        {/* A diamond on each day to meet, and Today; their words go in the list under it, where each reads whole on a phone. */}
        <div style={{ position: 'relative', height: 14 }}>
          {dates.map((d) => {
            const late = d.state === 'late' || d.state === 'missed'
            return (
              <span
                key={`${d.label}:${d.due}`}
                aria-hidden
                title={`${d.label} · ${shortDate(d.due)}`}
                style={{ position: 'absolute', left: x(d.due), top: 2, width: 9, height: 9, transform: 'translateX(-4px) rotate(45deg)', background: late ? C.red : d.state === 'hit' ? C.green : FAINT }}
              />
            )
          })}
          <span aria-hidden style={{ position: 'absolute', left: x(schedule.today), top: -2, bottom: 0, width: 2, background: C.blue, opacity: 0.6 }} />
        </div>
        <div data-portal-gc-dates style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 12 }}>
          {dates.map((d) => {
            const late = d.state === 'late' || d.state === 'missed'
            return (
              <span key={`${d.label}:${d.due}`} style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0, color: late ? PAPER_RED : d.state === 'hit' ? PAPER_GREEN : INK }}>
                <span aria-hidden style={{ width: 9, height: 9, transform: 'rotate(45deg)', background: late ? C.red : d.state === 'hit' ? C.green : FAINT, flex: 'none' }} />
                {d.label} · {shortDate(d.due)}
                {d.state === 'hit' ? ', met' : late ? `, ${d.daysLate} days late` : ''}
              </span>
            )
          })}
        </div>
      </div>
      {schedule.everyBar && (
        <div style={{ display: 'grid', gap: 6 }}>
          <button type="button" aria-pressed={everyBar} onClick={() => setEveryBar((v) => !v)} style={{ justifySelf: 'start', background: 'none', border: `1px solid ${HAIR}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: INK }}>
            {everyBar ? 'Back to the stages' : 'See every bar'}
          </button>
          {everyBar && (
            <div data-portal-gc-every-bar style={{ border: `1px solid ${HAIR}`, borderRadius: 8, overflow: 'hidden' }}>
              {schedule.groups.map((g) => (
                <div key={`${g.title}:${g.start}`} style={{ borderTop: `1px solid ${HAIR}` }}>
                  <div style={{ padding: '6px 10px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <strong>{g.title}</strong>
                    <span style={{ color: MUTED, fontSize: 12 }}>
                      {shortDate(g.start)} to {shortDate(g.finish)}
                      {g.now ? ' · now' : ''}
                    </span>
                  </div>
                  {g.bars.map((b) => (
                    <div key={`${b.label}:${b.start}`} style={{ padding: '4px 10px 4px 20px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline', fontSize: 12 }}>
                      <span style={{ flex: '1 1 10rem', minWidth: 0 }}>{b.label}</span>
                      <span style={{ color: MUTED }}>
                        {shortDate(b.start)} to {shortDate(b.finish)}
                      </span>
                      <span style={{ color: TONE[b.tone], fontWeight: 600 }}>{b.words}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ fontSize: 12, color: MUTED, display: 'grid', gap: 2 }}>
        <div>{schedule.finishWords}</div>
        {schedule.contractDays.map((s) => (
          <div key={s}>{s}</div>
        ))}
        {/* Whose the late days are, in their words: never a company, never the fee (G-98). */}
        {schedule.lateWords.map((s) => (
          <div key={s}>{s}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 2 }}>
        <strong>What changed this week</strong>
        {schedule.changes.length === 0 ? <div style={{ color: MUTED }}>{CUSTOMER_NOTHING_MOVED}</div> : schedule.changes.map((c) => <div key={c}>{c}</div>)}
      </div>
      {schedule.asks.length > 0 && (
        <div style={{ display: 'grid', gap: 2 }}>
          <strong>What we need from you</strong>
          {schedule.asks.map((a) => (
            <div key={a}>{a}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PortalGcSchedule
