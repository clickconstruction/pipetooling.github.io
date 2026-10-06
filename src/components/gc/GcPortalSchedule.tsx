/**
 * GC mode design spike: a company's own chart in its portal, the Gantt's Phase 3 (G-110; mock-up
 * `gantt-mockup.html`, picture 5). Its bars on the job, the work before it and the work waiting on
 * it, on the portal's paper, in its language. Other companies' work shows by name, never by price.
 */
import type { GcProject, GcState, Partner } from '../../lib/gcMode/gcModel'
import { daysBetween } from '../../lib/gcMode/gcModel'
import { pDate } from '../../lib/gcMode/gcPortalI18n'
import { portalSchedule, portalScheduleX, type PortalScheduleBar } from '../../lib/gcMode/gcPortalSchedule'
import { PortalBlock } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

const C = { blue: '#3b82f6', green: '#16a34a' }

export function GcPortalSchedule({ state, project, partner }: { state: GcState; project: GcProject; partner: Partner }) {
  const { lang, t } = usePortalLang()
  if (project.stage !== 'building') return null
  const s = portalSchedule(state, partner.id, project)
  if (!s) return null
  const x = (on: string) => `${portalScheduleX(s, on)}%`
  const w = (b: PortalScheduleBar) => `${((daysBetween(b.start, b.finish) + 1) / Math.max(1, daysBetween(s.first, s.last) + 1)) * 100}%`
  const row = (b: PortalScheduleBar) => {
    const done = b.pct >= 100
    return (
      <div key={b.lineId} style={{ display: 'contents' }}>
        <div style={{ minWidth: 0, fontSize: '0.85rem', color: b.mine ? 'var(--text-base)' : 'var(--text-muted)' }}>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: b.mine ? 600 : 400 }}>{b.label}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {b.mine ? '' : `${b.company} · `}
            {pDate(lang, b.start)} – {pDate(lang, b.finish)}
            {done ? ` · ${t('schedDone')}` : b.pct > 0 ? ` · ${Math.round(b.pct)}%` : ''}
            {b.slipDays > 0 ? ` · ${t('schedMoved', { days: b.slipDays })}` : ''}
          </div>
        </div>
        <div style={{ position: 'relative', height: 30 }}>
          <span
            title={`${b.label}: ${pDate(lang, b.start)} – ${pDate(lang, b.finish)}`}
            style={{ position: 'absolute', left: x(b.start), width: w(b), top: 8, height: 14, borderRadius: 4, boxSizing: 'border-box', border: `1.5px solid ${done ? C.green : b.mine ? C.blue : 'var(--border-strong)'}`, background: done ? 'var(--bg-green-200)' : b.mine ? 'var(--bg-blue-tint)' : 'var(--bg-muted)', overflow: 'hidden', opacity: b.mine ? 1 : 0.7 }}
          >
            {b.pct > 0 && !done && <span style={{ display: 'block', height: '100%', width: `${Math.min(100, b.pct)}%`, background: b.mine ? C.blue : 'var(--border-strong)', opacity: 0.75 }} />}
          </span>
        </div>
      </div>
    )
  }
  const group = (title: string, bars: PortalScheduleBar[]) =>
    bars.length === 0 ? null : (
      <div key={title} style={{ display: 'contents' }}>
        <div style={{ gridColumn: '1 / -1', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingTop: '0.3rem' }}>{title}</div>
        {bars.map(row)}
      </div>
    )
  return (
    <div data-portal-anchor="schedule" style={{ scrollMarginTop: '0.5rem' }}>
      <PortalBlock title={t('schedTitle')}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{t('schedIntro')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(9rem, 14rem) minmax(0, 1fr)', gap: '0.15rem 0.6rem', alignItems: 'center', position: 'relative' }}>
          {group(t('schedBefore'), s.before)}
          {group(t('schedYours'), s.mine)}
          {group(t('schedAfter'), s.after)}
          {/* Today, down the whole chart. */}
          <div style={{ gridColumn: 2, position: 'relative', height: 14 }}>
            <span style={{ position: 'absolute', left: x(state.today), transform: 'translateX(-50%)', fontSize: '0.68rem', fontWeight: 700, color: C.blue, whiteSpace: 'nowrap' }}>{t('schedToday')}</span>
          </div>
        </div>
      </PortalBlock>
    </div>
  )
}
