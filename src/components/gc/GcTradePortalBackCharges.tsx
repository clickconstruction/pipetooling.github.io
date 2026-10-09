import { useState } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import { portalBackCharges } from '../../lib/gc/portal'
import type { GcProject, TradePackage } from '../../lib/gc/types'
import { HAIR } from '../../lib/portal/portalTheme'
import { Btn, Chip, input } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePress } from './gcTradePortalPress'
import { PortalBlock } from './GcTradePortalUi'

/**
 * GC mode, the trade partner portal (P4b-ii): what we charged the company for on its job, from the design spike's
 * `GcPortalBackCharges.tsx`: cleanup, damage or work we finished for it, with the reason and a link to the photo. While a
 * charge is open the company agrees, or disputes it and says why (`answer_back_charge`); then it reads our answer and the
 * draw the charge came off. Only on a trade that is the company's: `portalBackCharges` holds that rule.
 */

const GC = GC_COMPANY.shortName
const PROBLEM = { color: 'var(--text-red-700)', fontSize: '0.8rem' } as const
const LINK = { color: 'var(--text-blue-500)', fontSize: '0.85rem' } as const

/** A photo is a Drive link the office typed: only an https link is drawn as one. */
const isHttps = (url: string) => /^https:\/\//i.test(url.trim())

export function GcTradePortalBackCharges({ project, pkg, partnerId, today }: { project: GcProject; pkg: TradePackage; partnerId: string; today: string }) {
  const { lang, t } = usePortalLang()
  const rows = portalBackCharges(project, pkg, partnerId, today, lang)
  if (rows.length === 0) return null
  return (
    // A to-do about a charge lands here.
    <div data-portal-anchor={`charges:${pkg.id}`} style={{ scrollMarginTop: '0.5rem' }}>
      <PortalBlock title={t('bcTitle', { trade: pkg.trade, gc: GC })}>
        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
          {rows.map((row, i) => (
            <div key={row.charge.id} style={{ display: 'grid', gap: '0.25rem', paddingTop: i === 0 ? 0 : '0.5rem', borderTop: i === 0 ? 'none' : `1px solid ${HAIR}` }}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{row.line}</strong>
                <Chip tone={row.tone}>{row.chip}</Chip>
              </div>
              <span>{row.charge.reason}</span>
              {row.charge.photo && isHttps(row.charge.photo) && (
                <a href={row.charge.photo.trim()} target="_blank" rel="noopener noreferrer" style={LINK}>
                  {t('bcPhotoOpen')} ↗
                </a>
              )}
              {row.theirReason && <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>{row.theirReason}</span>}
              <span style={{ fontSize: '0.85rem', color: row.tone === 'red' ? 'var(--text-red-700)' : row.tone === 'amber' ? 'var(--text-amber-800)' : undefined }}>{row.words}</span>
              {row.canAnswer && <Answer chargeId={row.charge.id} />}
            </div>
          ))}
        </div>
      </PortalBlock>
    </div>
  )
}

/** Agree, or dispute with a reason: one press each, and the page reads the slice again when it went through. */
function Answer({ chargeId }: { chargeId: string }) {
  const { t } = usePortalLang()
  const { busy, problem, run } = usePress()
  const [disputing, setDisputing] = useState(false)
  const [note, setNote] = useState('')
  if (!disputing) {
    return (
      <div style={{ display: 'grid', gap: '0.2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Btn disabled={busy} onClick={() => void run('answer_back_charge', { chargeId, agree: true, note: '' })}>
            {t('bcAgree')}
          </Btn>
          <Btn kind="quiet" disabled={busy} onClick={() => setDisputing(true)}>
            {t('bcDispute')}
          </Btn>
        </div>
        {problem && <span style={PROBLEM}>{problem}</span>}
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
        <Btn
          kind="primary"
          disabled={note.trim() === '' || busy}
          onClick={() => {
            void run('answer_back_charge', { chargeId, agree: false, note: note.trim() }).then((ok) => {
              if (ok) {
                setDisputing(false)
                setNote('')
              }
            })
          }}
        >
          {t('bcSendDispute', { gc: GC })}
        </Btn>
        <Btn kind="quiet" disabled={busy} onClick={() => setDisputing(false)}>
          {t('notNow')}
        </Btn>
      </div>
      {problem && <span style={PROBLEM}>{problem}</span>}
    </div>
  )
}
