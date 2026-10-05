import { GC_COMPANY, portalWeeks, type GcState, type Partner } from '../../lib/gcMode/gcModel'
import { PortalBlock, PortalNote, PortalTag } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: Your weeks, in the trade's portal (owner, 2026-10-05). A company's work on
 * every job of ours, this week and the next three, on one page: each activity with its days that
 * week, its first day on a job, the inspections on its jobs, and a warning when two jobs want it on
 * the same days. Marking the week stays on each job's page; a row opens that page.
 */

const GC = GC_COMPANY.shortName
const RULE = '#d9d2c3'

export function GcPortalWeeks({ state, partner, onHome, onOpenProject }: { state: GcState; partner: Partner; onHome: () => void; onOpenProject: (projectId: string) => void }) {
  const { lang, t } = usePortalLang()
  const weeks = portalWeeks(state, partner.id, lang)

  return (
    <div style={{ padding: '0.9rem', display: 'grid', gap: '0.9rem' }}>
      <div>
        <button
          type="button"
          onClick={onHome}
          style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.35rem' }}
        >
          {t('backHome', { gc: GC })}
        </button>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('wkTitle')}</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{t('wkIntro', { gc: GC })}</div>
      </div>

      {weeks.map((week) => (
        <PortalBlock key={week.weekOf} title={week.title}>
          <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.9rem' }}>
            {week.overlaps.map((words) => (
              <PortalNote key={words} tone="amber">
                {words}
              </PortalNote>
            ))}
            {week.items.length === 0 && <div style={{ opacity: 0.75 }}>{t('wkNone')}</div>}
            {week.items.map((item, i) => (
              <button
                key={`${item.project.id}:${item.row.activity.lineId}`}
                type="button"
                onClick={() => onOpenProject(item.project.id)}
                style={{
                  display: 'grid',
                  gap: '0.15rem',
                  textAlign: 'left',
                  padding: i === 0 ? '0 0 0.1rem' : '0.45rem 0 0.1rem',
                  border: 'none',
                  borderTop: i === 0 ? 'none' : `1px solid ${RULE}`,
                  background: 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                  {item.project.name} <span aria-hidden>›</span>
                </span>
                <strong>{item.name}</strong>
                <span style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                  {item.days}
                  {item.firstOnJob && <PortalTag tone="green">{t('wkFirst')}</PortalTag>}
                  {item.finishes && <PortalTag tone="grey">{t('wkFinishes')}</PortalTag>}
                </span>
              </button>
            ))}
            {week.inspections.length > 0 && (
              <div style={{ display: 'grid', gap: '0.15rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.45rem', fontSize: '0.85rem' }}>
                <strong>{t('wkInspections')}</strong>
                {week.inspections.map((insp) => (
                  <span key={insp.words}>{insp.words}</span>
                ))}
              </div>
            )}
          </div>
        </PortalBlock>
      ))}
    </div>
  )
}
