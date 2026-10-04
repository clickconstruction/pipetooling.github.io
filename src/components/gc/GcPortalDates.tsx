import { useState, type Dispatch } from 'react'
import { GC_COMPANY, portalPromises, type GcAction, type GcState, type Partner, type PortalPromiseRow } from '../../lib/gcMode/gcModel'
import { Btn, input } from './gcUi'
import { PortalBlock } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: the dates a company gave us for things other than a quote, on its home
 * (owner, 2026-10-04, question 8): the ones it gave here and the ones the office wrote down for it.
 * Each can be moved; the old day stays on the company's word record (the Board lane's gcPromises).
 */

const GC = GC_COMPANY.shortName
const RULE = '#d9d2c3'

export function GcPortalDates({ state, partner, dispatch }: { state: GcState; partner: Partner; dispatch: Dispatch<GcAction> }) {
  const { lang, t } = usePortalLang()
  const rows = portalPromises(state, partner.id, lang)
  if (rows.length === 0) return null
  return (
    <PortalBlock title={t('datesTitle', { gc: GC })}>
      <div style={{ display: 'grid', gap: '0.1rem', fontSize: '0.9rem' }}>
        <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '0.3rem' }}>{t('datesHelp', { gc: GC })}</div>
        {rows.map((row, i) => (
          <DateRow key={row.p.id} row={row} first={i === 0} partner={partner} today={state.today} dispatch={dispatch} />
        ))}
      </div>
    </PortalBlock>
  )
}

function DateRow({ row, first, partner, today, dispatch }: { row: PortalPromiseRow; first: boolean; partner: Partner; today: string; dispatch: Dispatch<GcAction> }) {
  const { t } = usePortalLang()
  const [moving, setMoving] = useState(false)
  const [day, setDay] = useState('')
  const { p } = row
  return (
    <div style={{ display: 'grid', gap: '0.25rem', padding: '0.45rem 0.1rem', borderTop: first ? 'none' : `1px solid ${RULE}` }}>
      <strong>{row.what}</strong>
      {row.where && <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>{row.where}</span>}
      <span style={{ fontSize: '0.85rem', color: row.tone === 'red' ? 'var(--text-red-700)' : row.tone === 'amber' ? 'var(--text-amber-800)' : undefined, fontWeight: row.tone === 'plain' ? 400 : 600 }}>
        {row.words}
      </span>
      {moving ? (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" min={today} value={day} onChange={(e) => setDay(e.target.value)} aria-label={t('newDateAria')} style={input} />
          <Btn
            kind="primary"
            disabled={day === '' || day === p.by}
            onClick={() => {
              dispatch({
                type: 'recordPromise',
                partnerId: partner.id,
                kind: p.kind,
                ...(p.projectId ? { projectId: p.projectId } : {}),
                ...(p.packageId ? { packageId: p.packageId } : {}),
                by: day,
                from: 'trade',
              })
              setMoving(false)
              setDay('')
            }}
          >
            {t('saveDate')}
          </Btn>
          <Btn kind="quiet" onClick={() => setMoving(false)}>
            {t('notNow')}
          </Btn>
        </div>
      ) : (
        <div>
          <Btn kind="quiet" onClick={() => setMoving(true)}>
            {t('moveDate')}
          </Btn>
        </div>
      )}
    </div>
  )
}
