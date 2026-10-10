import type { ReactNode } from 'react'
import { pDate } from '../../lib/gc/portalI18n'
import { daysBetween } from '../../lib/gc/schedule/network'
import { portalScheduleX, type PortalSchedule, type PortalScheduleBar } from '../../lib/gc/schedule/portalSchedule'
import { HAIR, INK, MUTED, NOTE_BAND } from '../../lib/portal/portalTheme'
import { usePortalLang } from './gcTradePortalLang'
import { PortalBlock } from './GcTradePortalUi'

/**
 * GC mode, the schedule's PR 14b: a company's own chart in its portal (G-110; the plan is
 * to-dos/gc-mode/mockups/schedule-pr14b.md on branch spike/gc-mode), the prototype's `GcPortalSchedule.tsx` drawn from
 * `gc-trade-portal`'s answer rather than from a state. Its bars on the job, the work before it and the work waiting on
 * it, each by its company's name and never by price, on the portal's paper and in its language. It sits first on the
 * job's page, under the job's name (gc 3's pick, call 8). `ownRow` is a slot under each of its own bars, where the
 * Portal's late door can sit (call 9).
 */

const C = { blue: '#3b82f6', green: '#16a34a' }

export function GcTradePortalSchedule({ schedule, today, ownRow }: { schedule: PortalSchedule; today: string; ownRow?: (bar: PortalScheduleBar) => ReactNode }) {
  const { lang, t } = usePortalLang()
  const s = schedule
  const x = (on: string) => `${portalScheduleX(s, on)}%`
  const w = (b: PortalScheduleBar) => `${((daysBetween(b.start, b.finish) + 1) / Math.max(1, daysBetween(s.first, s.last) + 1)) * 100}%`
  const row = (b: PortalScheduleBar) => {
    const done = b.pct >= 100
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
        <div style={{ position: 'relative', height: 30 }}>
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
