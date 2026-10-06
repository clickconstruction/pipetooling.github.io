/**
 * GC mode design spike: "Your dates moved" in the trade's portal, the Gantt's Phase 3 (G-113). The
 * office told the company its days changed; here is the message as it went, with two answers:
 * the dates work, or it needs another day, with the day and a word on why. One block per job.
 */
import { useState, type Dispatch } from 'react'
import type { GcAction, GcProject, GcState, Partner } from '../../lib/gcMode/gcModel'
import { datesNotices } from '../../lib/gcMode/gcTellTrades'
import { pDate } from '../../lib/gcMode/gcPortalI18n'
import { PortalBlock, PortalTag } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'
import { Btn, input } from './gcUi'

export function GcPortalDatesMoved({ state, project, partner, dispatch }: { state: GcState; project: GcProject; partner: Partner; dispatch: Dispatch<GcAction> }) {
  const { lang, t } = usePortalLang()
  const notices = datesNotices(state, partner.id, lang).filter((n) => n.project.id === project.id)
  const [asking, setAsking] = useState<string | null>(null)
  const [day, setDay] = useState('')
  const [note, setNote] = useState('')
  const [thanked, setThanked] = useState<string | null>(null)
  if (notices.length === 0 && !thanked) return null
  return (
    <div data-portal-anchor="dates" style={{ scrollMarginTop: '0.5rem' }}>
      <PortalBlock title={t('datesMoved')}>
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          {thanked && notices.length === 0 && <div style={{ fontSize: '0.875rem' }}>{t('datesThanks')}</div>}
          {notices.map((n) => (
            <div key={n.move.id} style={{ display: 'grid', gap: '0.45rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <PortalTag tone="grey">{pDate(lang, n.move.toldOn ?? n.move.on)}</PortalTag>
                <strong>{n.message.subject}</strong>
              </div>
              {n.message.lines.slice(1).map((line) => (
                <div key={line}>{line}</div>
              ))}
              {asking === n.move.id ? (
                <div style={{ display: 'grid', gap: '0.4rem', padding: '0.6rem', background: 'var(--bg-subtle)', borderRadius: 8 }}>
                  <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>{t('datesAnotherDay')}</span>
                    <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label={t('datesAnotherDay')} style={input} />
                  </label>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('datesNote')} aria-label={t('datesNote')} style={{ ...input, width: '100%', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Btn
                      kind="primary"
                      disabled={!day}
                      onClick={() => {
                        dispatch({ type: 'tradeAnswerDates', projectId: project.id, partnerId: partner.id, moveId: n.move.id, ok: false, day, note })
                        setAsking(null)
                        setThanked(n.move.id)
                      }}
                    >
                      {t('datesSend')}
                    </Btn>
                    <Btn kind="quiet" onClick={() => setAsking(null)}>
                      ←
                    </Btn>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <Btn
                    kind="primary"
                    onClick={() => {
                      dispatch({ type: 'tradeAnswerDates', projectId: project.id, partnerId: partner.id, moveId: n.move.id, ok: true })
                      setThanked(n.move.id)
                    }}
                  >
                    {t('datesWork')}
                  </Btn>
                  <Btn
                    kind="plain"
                    onClick={() => {
                      setAsking(n.move.id)
                      setDay(n.lines[0]?.to.start ?? '')
                      setNote('')
                    }}
                  >
                    {t('datesAnother')}
                  </Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      </PortalBlock>
    </div>
  )
}
