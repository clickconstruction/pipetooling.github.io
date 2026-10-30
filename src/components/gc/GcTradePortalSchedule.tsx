import type { ReactNode } from 'react'
import { pDate } from '../../lib/gc/portalI18n'
import { daysBetween } from '../../lib/gc/schedule/network'
import { portalScheduleX, type PortalDate, type PortalPhase, type PortalSchedule, type PortalScheduleBar } from '../../lib/gc/schedule/portalSchedule'
import { HAIR, INK, MUTED, NOTE_BAND } from '../../lib/portal/portalTheme'
import { usePortalLang } from './gcTradePortalLang'
import { PortalBlock } from './GcTradePortalUi'

/**
 * GC mode, the schedule's PR 14b: a company's own chart in its portal (G-110; the plan is
 * to-dos/gc-mode/mockups/schedule-pr14b.md on branch spike/gc-mode), the prototype's `GcPortalSchedule.tsx` drawn from
 * `gc-trade-portal`'s answer rather than from a state. Its bars on the job, the work before it and the work waiting on
 * it, each by its company's name and never by price, on the portal's paper and in its language. It sits first on the
 * job's page, under the job's name (gc 3's pick, call 8). `ownRow` is a slot under each of its own bars, where the
 * Portal's late door can sit (call 9). Since #204's PR 6 (the owner's call 5), the job's phases as a strip with their
 * dates and the dates to meet sit above the bars, on the whole job's own axis, and never another company's bars.
 */

const C = { blue: '#3b82f6', green: '#16a34a', faint: '#9ca3af', amber: '#d97706' }

export function GcTradePortalSchedule({
  schedule,
  today,
  ownRow,
  ghost,
}: {
  schedule: PortalSchedule
  today: string
  ownRow?: (bar: PortalScheduleBar) => ReactNode
  /** Punch list #217 (outside-13): the old days of one of its own bars, a dashed ghost behind it with a label; none as today. */
  ghost?: (bar: PortalScheduleBar) => { start: string; finish: string; label: string } | null
}) {
  const { lang, t } = usePortalLang()
  const s = schedule
  const x = (on: string) => `${portalScheduleX(s, on)}%`
  const w = (b: PortalScheduleBar) => `${((daysBetween(b.start, b.finish) + 1) / Math.max(1, daysBetween(s.first, s.last) + 1)) * 100}%`
  const wSpan = (start: string, finish: string) => `${((daysBetween(start, finish) + 1) / Math.max(1, daysBetween(s.first, s.last) + 1)) * 100}%`
  const row = (b: PortalScheduleBar) => {
    const done = b.pct >= 100
    // The ghost of the old days (punch list #217, outside-13), kept inside the chart's span.
    const asked = b.mine && ghost ? ghost(b) : null
    const clamped = asked ? { ...asked, start: asked.start < s.first ? s.first : asked.start, finish: asked.finish > s.last ? s.last : asked.finish } : null
    const g = clamped && clamped.start <= clamped.finish ? clamped : null
    return (
      <div key={b.lineId} data-portal-bar={b.mine ? 'mine' : 'theirs'} style={{ display: 'contents' }}>
        <div style={{ minWidth: 0, fontSize: '0.85rem', color: b.mine ? INK : MUTED }}>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: b.mine ? 600 : 400 }}>{b.label}</div>
          <div style={{ fontSize: '0.75rem', color: MUTED }}>
            {b.mine ? '' : `${b.company} · `}
            {pDate(lang, b.start)} – {pDate(lang, b.finish)}
            {done ? ` · ${t('schedDone')}` : b.pct > 0 ? ` · ${Math.round(b.pct)}%` : ''}
            {b.slipDays > 0 ? ` · ${t('schedMoved', { days: b.slipDays })}` : ''}
          </div>
        </div>
        <div style={{ position: 'relative', height: g ? 44 : 30 }}>
          {g && (
            <>
              <span aria-hidden data-portal-ghost={b.lineId} title={g.label} style={{ position: 'absolute', left: x(g.start), width: wSpan(g.start, g.finish), top: 8, height: 14, borderRadius: 4, boxSizing: 'border-box', border: `1.5px dashed ${C.amber}`, background: 'var(--bg-amber-100)', opacity: 0.8 }} />
              <span data-portal-ghost-label style={{ position: 'absolute', left: x(g.start), top: 25, fontSize: '0.66rem', lineHeight: 1.2, color: MUTED, whiteSpace: 'nowrap' }}>
                {g.label}
              </span>
            </>
          )}
          <span
            title={`${b.label}: ${pDate(lang, b.start)} – ${pDate(lang, b.finish)}`}
            style={{
              position: 'absolute',
              left: x(b.start),
              width: w(b),
              top: 8,
              height: 14,
              borderRadius: 4,
              boxSizing: 'border-box',
              border: `1.5px solid ${done ? C.green : b.mine ? C.blue : HAIR}`,
              background: done ? 'var(--bg-green-200)' : b.mine ? 'var(--bg-blue-tint)' : NOTE_BAND,
              overflow: 'hidden',
              opacity: b.mine ? 1 : 0.8,
            }}
          >
            {b.pct > 0 && !done && <span style={{ display: 'block', height: '100%', width: `${Math.min(100, b.pct)}%`, background: b.mine ? C.blue : HAIR, opacity: 0.75 }} />}
          </span>
        </div>
        {b.mine && ownRow && <div style={{ gridColumn: '1 / -1' }}>{ownRow(b)}</div>}
      </div>
    )
  }
  const group = (title: string, bars: PortalScheduleBar[]) =>
    bars.length === 0 ? null : (
      <div key={title} style={{ display: 'contents' }}>
        <div style={{ gridColumn: '1 / -1', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED, paddingTop: '0.3rem' }}>{title}</div>
        {bars.map(row)}
      </div>
    )
  return (
    <div data-portal-anchor="schedule" style={{ scrollMarginTop: '0.5rem' }}>
      <PortalBlock title={t('schedTitle')}>
        {s.phases && s.phases.length > 0 && <PhasesStrip phases={s.phases} dates={s.dates ?? []} today={today} />}
        <div style={{ fontSize: '0.8rem', color: MUTED, marginBottom: '0.4rem' }}>{t('schedIntro')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(7rem, 14rem) minmax(0, 1fr)', gap: '0.15rem 0.6rem', alignItems: 'center', position: 'relative' }}>
          {group(t('schedBefore'), s.before)}
          {group(t('schedYours'), s.mine)}
          {group(t('schedAfter'), s.after)}
          {/* Today, under the chart. */}
          <div style={{ gridColumn: 2, position: 'relative', height: 14 }}>
            <span data-portal-today style={{ position: 'absolute', left: x(today), transform: 'translateX(-50%)', fontSize: '0.68rem', fontWeight: 700, color: C.blue, whiteSpace: 'nowrap' }}>
              {t('schedToday')}
            </span>
          </div>
        </div>
      </PortalBlock>
    </div>
  )
}

/**
 * The job's phases as a strip, each with its dates and days, then the dates to meet as diamonds with their words
 * under them, on the whole job's own axis with Today (#204, PR 6). Nothing of another company's work is here.
 */
function PhasesStrip({ phases, dates, today }: { phases: PortalPhase[]; dates: PortalDate[]; today: string }) {
  const { lang, t } = usePortalLang()
  const head = phases[0]
  if (!head) return null
  const first = phases.reduce((a, p) => (p.start < a ? p.start : a), head.start)
  const last = [...phases.map((p) => p.finish), ...dates.map((d) => d.on)].reduce((a, b) => (b > a ? b : a), head.finish)
  const days = Math.max(1, daysBetween(first, last) + 1)
  const x = (on: string) => `${(Math.max(0, Math.min(days, daysBetween(first, on))) / days) * 100}%`
  const w = (start: string, finish: string) => `${((daysBetween(start, finish) + 1) / days) * 100}%`
  const todayOn = today >= first && today <= last
  return (
    <div data-portal-phases style={{ display: 'grid', gap: '0.15rem 0.6rem', gridTemplateColumns: 'minmax(7rem, 14rem) minmax(0, 1fr)', alignItems: 'center', marginBottom: '0.6rem', paddingBottom: '0.5rem', borderBottom: `1px solid ${HAIR}` }}>
      <div style={{ gridColumn: '1 / -1', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>{t('schedPhases')}</div>
      {phases.map((p) => {
        const done = p.finish < today
        const now = !done && p.start <= today
        return (
          <div key={`${p.name}:${p.start}`} data-portal-phase style={{ display: 'contents' }}>
            <div style={{ minWidth: 0, fontSize: '0.85rem', color: INK }}>
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: now ? 600 : 400 }}>{p.name}</div>
              <div style={{ fontSize: '0.75rem', color: MUTED }}>
                {pDate(lang, p.start)} – {pDate(lang, p.finish)} · {t('schedDays', { days: p.days })}
              </div>
            </div>
            <div style={{ position: 'relative', height: 22 }} title={`${p.name}: ${pDate(lang, p.start)} – ${pDate(lang, p.finish)}`}>
              <span style={{ position: 'absolute', left: x(p.start), width: w(p.start, p.finish), top: 4, height: 14, borderRadius: 4, boxSizing: 'border-box', border: `1.5px solid ${done ? C.green : now ? C.blue : HAIR}`, background: done ? 'var(--bg-green-200)' : now ? 'var(--bg-blue-tint)' : NOTE_BAND }} />
            </div>
          </div>
        )
      })}
      {dates.length > 0 && (
        <>
          <div style={{ fontSize: '0.8rem', color: MUTED }}>{t('schedDates')}</div>
          <div style={{ position: 'relative', height: 14 }}>
            {dates.map((d) => (
              <span key={`${d.label}:${d.on}`} aria-hidden title={`${d.label} · ${pDate(lang, d.on)}`} style={{ position: 'absolute', left: x(d.on), top: 2, width: 9, height: 9, transform: 'translateX(-4px) rotate(45deg)', background: d.met ? C.green : C.faint }} />
            ))}
            {todayOn && <span aria-hidden style={{ position: 'absolute', left: x(today), top: -2, bottom: 0, width: 2, background: C.blue, opacity: 0.6 }} />}
          </div>
          <div data-portal-dates style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: '0.78rem', color: INK }}>
            {dates.map((d) => (
              <span key={`${d.label}:${d.on}`} style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0 }}>
                <span aria-hidden style={{ width: 9, height: 9, transform: 'rotate(45deg)', background: d.met ? C.green : C.faint, flex: 'none' }} />
                {d.label} · {pDate(lang, d.on)}
                {d.met ? `, ${t('schedMet')}` : ''}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
