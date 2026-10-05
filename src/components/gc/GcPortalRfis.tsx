import { useState, type Dispatch } from 'react'
import {
  GC_COMPANY,
  pDate,
  portalCanAskRfi,
  portalRfis,
  rfiHolds,
  rfiLabel,
  rfiNeededBy,
  rfiState,
  type GcAction,
  type GcProject,
  type GcState,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip, input } from './gcUi'
import { PortalBlock } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: a trade asks a question about the plans while we build, from its job page
 * (an RFI; the owner, 2026-10-05: "trades ask from their portal"). It comes to the office first,
 * which answers it or sends it to the architect. Below, each question it asked or that is about its
 * trade, where it stands, and the answer once it comes. Office screen: GcBuildingRfis.tsx.
 */

const GC = GC_COMPANY.shortName
const RULE = '#d9d2c3'

export function GcPortalRfis({ state, project, pkg, partnerId, dispatch }: { state: GcState; project: GcProject; pkg: TradePackage; partnerId: string; dispatch: Dispatch<GcAction> }) {
  const { lang, t } = usePortalLang()
  const [asking, setAsking] = useState(false)
  const [question, setQuestion] = useState('')
  const [sheets, setSheets] = useState('')
  const canAsk = portalCanAskRfi(project, pkg.id, partnerId)
  const rfis = portalRfis(project, pkg.id, partnerId)
  if (!canAsk && rfis.length === 0) return null
  const field = { ...input, width: '100%', minWidth: 0, boxSizing: 'border-box' } as const
  return (
    <PortalBlock title={t('rfiTitle', { trade: pkg.trade })}>
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }} data-tour="gc-portal-rfis">
        {rfis.length === 0 && !asking && <div style={{ opacity: 0.85 }}>{t('rfiHelp', { gc: GC })}</div>}
        {rfis.map((rfi, i) => {
          const st = rfiState(rfi)
          const first = rfiHolds(state, project, rfi)[0]
          const neededBy = st === 'answered' ? null : rfiNeededBy(state, project, rfi)
          return (
            <div key={rfi.id} style={{ display: 'grid', gap: '0.2rem', paddingTop: i === 0 ? 0 : '0.45rem', borderTop: i === 0 ? 'none' : `1px solid ${RULE}` }}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{rfiLabel(rfi)}</strong>
                <Chip tone={st === 'answered' ? 'green' : st === 'architect' ? 'blue' : 'amber'}>
                  {st === 'answered' ? t('rfiChipAnswered') : st === 'architect' ? t('rfiChipArchitect') : t('rfiChipUs', { gc: GC })}
                </Chip>
              </div>
              <span>{rfi.question}</span>
              <span style={{ fontSize: '0.82rem', opacity: 0.8 }}>
                {rfi.answer
                  ? t('rfiAnswered', { date: pDate(lang, rfi.answer.on), answer: rfi.answer.text })
                  : t(st === 'architect' ? 'rfiWithArchitect' : 'rfiWithUs', { date: pDate(lang, rfi.askedOn), gc: GC })}
              </span>
              {first && neededBy && (
                <span style={{ fontSize: '0.82rem', color: neededBy <= state.today ? 'var(--text-red-700)' : 'var(--text-amber-800)' }}>
                  {t('rfiNeeded', { work: first.name, date: pDate(lang, first.start) })}
                </span>
              )}
            </div>
          )
        })}
        {canAsk &&
          (asking ? (
            <div style={{ display: 'grid', gap: '0.45rem', borderTop: rfis.length > 0 ? `1px solid ${RULE}` : 'none', paddingTop: rfis.length > 0 ? '0.5rem' : 0 }}>
              <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
                <strong>{t('rfiQuestion')}</strong>
                <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('rfiQuestionHint')} rows={3} style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }} />
              </label>
              <input value={sheets} onChange={(e) => setSheets(e.target.value)} placeholder={t('rfiSheets')} aria-label={t('rfiSheets')} style={field} />
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Btn
                  kind="primary"
                  disabled={question.trim() === ''}
                  onClick={() => {
                    dispatch({ type: 'tradeAskRfi', projectId: project.id, packageId: pkg.id, partnerId, question: question.trim(), sheets: sheets.split(',').map((x) => x.trim()).filter(Boolean) })
                    setQuestion('')
                    setSheets('')
                    setAsking(false)
                  }}
                >
                  {t('rfiSend', { gc: GC })}
                </Btn>
                <Btn kind="quiet" onClick={() => setAsking(false)}>
                  {t('notNow')}
                </Btn>
              </div>
            </div>
          ) : (
            <div style={{ borderTop: rfis.length > 0 ? `1px solid ${RULE}` : 'none', paddingTop: rfis.length > 0 ? '0.45rem' : 0 }}>
              <Btn onClick={() => setAsking(true)} wrap>
                {t('rfiAsk', { gc: GC })}
              </Btn>
            </div>
          ))}
      </div>
    </PortalBlock>
  )
}
