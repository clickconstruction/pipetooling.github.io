import { useState, type Dispatch } from 'react'
import { GC_COMPANY, portalBackCharges, type GcAction, type GcProject, type TradePackage } from '../../lib/gcMode/gcModel'
import { Btn, Chip, input } from './gcUi'
import { PortalBlock } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: what we charged a company for on its job page (owner, 2026-10-05): cleanup,
 * damage, or work we finished for it, with the reason and the photo. It agrees, or disputes it and
 * says why, by the answer day; then it reads our answer and the draw the charge came off.
 */

const GC = GC_COMPANY.shortName
const RULE = '#d9d2c3'

export function GcPortalBackCharges({
  project,
  pkg,
  partnerId,
  today,
  dispatch,
}: {
  project: GcProject
  pkg: TradePackage
  partnerId: string
  today: string
  dispatch: Dispatch<GcAction>
}) {
  const { lang, t } = usePortalLang()
  const rows = portalBackCharges(project, pkg, partnerId, today, lang)
  if (rows.length === 0) return null
  return (
    // A to-do about a charge lands here.
    <div data-portal-anchor={`charges:${pkg.id}`} style={{ scrollMarginTop: '0.5rem' }}>
      <PortalBlock title={t('bcTitle', { trade: pkg.trade, gc: GC })}>
        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
          {rows.map((row, i) => (
            <div key={row.charge.id} style={{ display: 'grid', gap: '0.25rem', paddingTop: i === 0 ? 0 : '0.5rem', borderTop: i === 0 ? 'none' : `1px solid ${RULE}` }}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{row.line}</strong>
                <Chip tone={row.tone}>{row.chip}</Chip>
              </div>
              <span>{row.charge.reason}</span>
              {row.charge.photo && <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>{t('bcPhoto', { name: row.charge.photo })}</span>}
              {row.theirReason && <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>{row.theirReason}</span>}
              <span style={{ fontSize: '0.85rem', color: row.tone === 'red' ? 'var(--text-red-700)' : row.tone === 'amber' ? 'var(--text-amber-800)' : undefined }}>{row.words}</span>
              {row.canAnswer && (
                <Answer
                  onAgree={() => dispatch({ type: 'tradeAnswerBackCharge', projectId: project.id, packageId: pkg.id, chargeId: row.charge.id, agree: true, note: '' })}
                  onDispute={(note) => dispatch({ type: 'tradeAnswerBackCharge', projectId: project.id, packageId: pkg.id, chargeId: row.charge.id, agree: false, note })}
                />
              )}
            </div>
          ))}
        </div>
      </PortalBlock>
    </div>
  )
}

function Answer({ onAgree, onDispute }: { onAgree: () => void; onDispute: (note: string) => void }) {
  const { t } = usePortalLang()
  const [disputing, setDisputing] = useState(false)
  const [note, setNote] = useState('')
  if (!disputing) {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn onClick={onAgree}>{t('bcAgree')}</Btn>
        <Btn kind="quiet" onClick={() => setDisputing(true)}>
          {t('bcDispute')}
        </Btn>
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
        <strong>{t('bcWhy')}</strong>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ ...input, width: '100%', minWidth: 0, boxSizing: 'border-box', resize: 'vertical' }} />
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={note.trim() === ''} onClick={() => onDispute(note.trim())}>
          {t('bcSendDispute', { gc: GC })}
        </Btn>
        <Btn kind="quiet" onClick={() => setDisputing(false)}>
          {t('notNow')}
        </Btn>
      </div>
    </div>
  )
}
