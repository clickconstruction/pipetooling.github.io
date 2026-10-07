/**
 * GC mode design spike: the customer's schedule in their portal, the Gantt's Phase 3 (G-90 to
 * G-93; mock-up `gantt-mockup.html`, picture 4). The same dates as the office's chart, as the
 * stages of their job: no company names, no dollars, no spare days. Then what changed this week
 * and what we need from them. Drawn on the portal's paper, in the light theme.
 */
import type { GcProject, GcState } from '../../lib/gcMode/gcModel'
import { daysBetween, shortDate, weekdayDate } from '../../lib/gcMode/gcModel'
import { useState } from 'react'
import { CUSTOMER_NOTHING_MOVED, customerAsks, customerChanges, customerFullChart, customerMaySeeEveryBar, customerMilestones, customerStages, customerStanding } from '../../lib/gcMode/gcCustomerSchedule'
import { GcGanttList } from './GcGanttList'
import { customerContractDays } from '../../lib/gcMode/gcChangeOrderDays'
import { lateFinish } from '../../lib/gcMode/gcLateFinish'
import { PortalBlock } from './GcPortalUi'

/** Saturated on purpose: the same status colors as the office's chart. */
const C = { blue: '#3b82f6', green: '#16a34a', red: '#dc2626', amber: '#d97706' }

export function GcCustomerSchedule({ state, project }: { state: GcState; project: GcProject }) {
  const stages = customerStages(state, project)
  // A GC or an owner's rep may see every bar (call 3): the List view, with no company, no dollars, no spare days.
  const [everyBar, setEveryBar] = useState(false)
  if (stages.length === 0) return null
  const standing = customerStanding(state, project)
  const milestones = customerMilestones(state, project)
  const changes = customerChanges(project, state.today)
  const asks = customerAsks(project)
  // What their signed change orders did to the contract's finish (G-76).
  const contractDays = customerContractDays(project)
  const first = stages.reduce((a, s) => (s.start < a ? s.start : a), stages[0]?.start ?? state.today)
  const last = [standing.finish ?? '', ...stages.map((s) => s.finish), ...milestones.map((m) => m.due)].reduce((a, b) => (b > a ? b : a), '')
  const days = Math.max(1, daysBetween(first, last) + 1)
  const x = (on: string) => `${(daysBetween(first, on) / days) * 100}%`
  const w = (start: string, finish: string) => `${((daysBetween(start, finish) + 1) / days) * 100}%`
  const stat = (label: string, value: string, sub: string, tone?: string) => (
    <div>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: tone }}>{value}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
  return (
    <PortalBlock title="Your schedule">
      <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', gap: '1.4rem', flexWrap: 'wrap' }}>
          {stat('We finish', standing.finish ? weekdayDate(standing.finish) : 'Not drawn yet', standing.contract ? `your contract says ${shortDate(standing.contract)}` : '', standing.late > 0 ? 'var(--text-red-700)' : undefined)}
          {stat('Work done', `${standing.donePct}%`, `we planned ${standing.plannedPct}% by today`)}
          {standing.next && stat('Next for you', standing.next.milestone.label, standing.next.state === 'late' ? `${weekdayDate(standing.next.due)}, ${standing.next.daysLate} days late` : weekdayDate(standing.next.due), standing.next.state === 'late' ? 'var(--text-red-700)' : undefined)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(8rem, 12rem) minmax(0, 1fr)', gap: '0.3rem 0.6rem', alignItems: 'center' }}>
          {stages.map((s) => {
            const color = s.state === 'done' ? C.green : s.state === 'behind' ? C.amber : C.blue
            return (
              <div key={s.key} style={{ display: 'contents' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem', minWidth: 0 }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                  <span style={{ color: s.state === 'behind' ? 'var(--text-amber-800)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(s.pct)}%</span>
                </div>
                <div style={{ position: 'relative', height: 16 }} title={`${s.label}: ${shortDate(s.start)} to ${shortDate(s.finish)}, ${Math.round(s.pct)}% done`}>
                  <span style={{ position: 'absolute', left: x(s.start), width: w(s.start, s.finish), top: 1, height: 14, borderRadius: 4, boxSizing: 'border-box', border: `1.5px solid ${color}`, background: s.state === 'done' ? 'var(--bg-green-200)' : 'var(--bg-blue-tint)', overflow: 'hidden' }}>
                    {s.pct > 0 && s.state !== 'done' && <span style={{ display: 'block', height: '100%', width: `${Math.min(100, s.pct)}%`, background: color, opacity: 0.7 }} />}
                  </span>
                </div>
              </div>
            )
          })}
          <div style={{ color: 'var(--text-muted)' }}>Dates to meet</div>
          {/* A diamond on each day to meet. Their words go in the list under it, where each reads whole however narrow the
              portal is: beside the diamonds they ran off its edge (the phone pass, round five). */}
          <div style={{ position: 'relative', height: 14 }}>
            {milestones.map((m) => {
              const late = m.state === 'late' || m.state === 'missed'
              return (
                <span
                  key={m.milestone.id}
                  aria-hidden
                  title={`${m.milestone.label} · ${shortDate(m.due)}`}
                  style={{ position: 'absolute', left: x(m.due), top: 2, width: 9, height: 9, transform: 'translateX(-4px) rotate(45deg)', background: late ? C.red : m.state === 'hit' ? C.green : 'var(--text-muted)' }}
                />
              )
            })}
            {/* Today, on the same line. */}
            <span aria-hidden style={{ position: 'absolute', left: x(state.today), top: -2, bottom: 0, width: 2, background: C.blue, opacity: 0.6 }} />
          </div>
          <div data-gc-dates-to-meet style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.8rem', fontSize: '0.72rem' }}>
            {milestones.map((m) => {
              const late = m.state === 'late' || m.state === 'missed'
              return (
                <span key={m.milestone.id} style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0, color: late ? 'var(--text-red-700)' : m.state === 'hit' ? 'var(--text-green-800)' : 'var(--text-600)' }}>
                  <span aria-hidden style={{ width: 9, height: 9, transform: 'rotate(45deg)', background: late ? C.red : m.state === 'hit' ? C.green : 'var(--text-muted)', flex: 'none' }} />
                  {m.milestone.label} · {shortDate(m.due)}
                  {m.state === 'hit' ? ', met' : late ? `, ${m.daysLate} days late` : ''}
                </span>
              )
            })}
          </div>
        </div>
        {customerMaySeeEveryBar(project) && (
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            <button type="button" aria-pressed={everyBar} onClick={() => setEveryBar((v) => !v)} style={{ justifySelf: 'start', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-base)' }}>
              {everyBar ? 'Back to the stages' : 'See every bar'}
            </button>
            {everyBar && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <GcGanttList groups={customerFullChart(state, project)} today={state.today} building={project.stage === 'building'} picked={null} onPick={() => undefined} plain />
              </div>
            )}
          </div>
        )}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {standing.finishWords}
          {contractDays.map((s) => (
            <div key={s}>{s}</div>
          ))}
          {/* Whose the late days are, in their words: never a company, never the fee (G-98). */}
          {lateFinish(state, project).customerWords.map((s) => (
            <div key={s}>{s}</div>
          ))}
        </div>
        <div>
          <strong>What changed this week</strong>
          {changes.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>{CUSTOMER_NOTHING_MOVED}</div> : changes.map((c) => <div key={c}>{c}</div>)}
        </div>
        {asks.length > 0 && (
          <div>
            <strong>What we need from you</strong>
            {asks.map((a) => (
              <div key={a.words}>{a.words}</div>
            ))}
          </div>
        )}
      </div>
    </PortalBlock>
  )
}
