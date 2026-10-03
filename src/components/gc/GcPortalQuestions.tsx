import { useState, type Dispatch } from 'react'
import {
  GC_COMPANY,
  pDate,
  planLabel,
  portalQuestions,
  pWeekday,
  questionsCloseOn,
  questionsOpen,
  type GcAction,
  type GcProject,
  type Partner,
  type PortalQuestion,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip, input } from './gcUi'
import { SheetChip } from './GcPortalLineSheets'
import { PortalBlock } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: questions about the plans, on a trade's job page in the portal (owner,
 * 2026-10-03). The company asks, with the sheets it is about if it wants; the New Project lane's
 * office side sends it to the architect and the answer out. A company sees every question it
 * asked, and another company's once the answer reaches it, never who asked. While we bid, questions
 * close three days before our bid is due.
 */

const GC = GC_COMPANY.shortName
const RULE = '#d9d2c3'

export function GcPortalQuestions({
  project,
  pkg,
  partner,
  today,
  dispatch,
  onOpenSheet,
}: {
  project: GcProject
  pkg: TradePackage
  partner: Partner
  today: string
  dispatch: Dispatch<GcAction>
  onOpenSheet: (sheetId: string) => void
}) {
  const { lang, t } = usePortalLang()
  const [text, setText] = useState('')
  const [sheets, setSheets] = useState('')
  const list = portalQuestions(project, pkg.id, partner.id)
  // The New Project lane's rule, so this box and its Questions window close on one day.
  const open = questionsOpen(project, today)
  const closeOn = questionsCloseOn(project)

  return (
    <PortalBlock title={t('questionsTitle', { trade: pkg.trade })}>
      <div style={{ display: 'grid', gap: '0.55rem', fontSize: '0.9rem' }}>
        {open ? (
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              {t('askPrompt')}
              {closeOn && <> {t('askBy', { date: pWeekday(lang, closeOn) })}</>}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              aria-label={t('yourQuestion')}
              placeholder={t('yourQuestion')}
              style={{ ...input, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />
            <input style={input} value={sheets} onChange={(e) => setSheets(e.target.value)} placeholder={t('questionSheets')} aria-label={t('questionSheets')} />
            <div>
              <Btn
                kind="primary"
                disabled={text.trim() === ''}
                onClick={() => {
                  dispatch({
                    type: 'tradeAskQuestion',
                    projectId: project.id,
                    packageId: pkg.id,
                    partnerId: partner.id,
                    text: text.trim(),
                    sheets: sheets.split(/[\s,]+/).filter(Boolean),
                  })
                  setText('')
                  setSheets('')
                }}
              >
                {t('sendQuestion')}
              </Btn>
            </div>
          </div>
        ) : (
          closeOn && <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{t('askClosed', { date: pWeekday(lang, closeOn) })}</div>
        )}

        {list.map((pq) => (
          <Question key={pq.q.id} pq={pq} project={project} onOpenSheet={onOpenSheet} />
        ))}
      </div>
    </PortalBlock>
  )
}

function Question({ pq, project, onOpenSheet }: { pq: PortalQuestion; project: GcProject; onOpenSheet: (sheetId: string) => void }) {
  const { lang, t } = usePortalLang()
  const { q } = pq
  return (
    <div style={{ display: 'grid', gap: '0.25rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.45rem' }}>
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem', opacity: 0.85 }}>
        <span>{t(pq.mine ? 'youAsked' : 'anotherAsked', { date: pDate(lang, q.askedOn) })}</span>
        {(q.sheets ?? []).map((id) => (
          <SheetChip key={id} id={id} changed={false} onOpen={onOpenSheet} />
        ))}
        {pq.state === 'asked' && <Chip tone="grey">{t('qWaiting', { gc: GC })}</Chip>}
        {pq.state === 'with the architect' && <Chip tone="blue">{t('qWithArchitect')}</Chip>}
      </div>
      <div>{q.text}</div>
      {q.answer !== null && pq.answerOn && (
        <div style={{ background: 'var(--surface)', border: `1px solid ${RULE}`, borderRadius: 6, padding: '0.4rem 0.55rem' }}>
          <strong>{t('qAnswer', { date: pDate(lang, pq.answerOn) })}</strong> {q.answer}
          {q.inSetRev !== undefined && <span style={{ opacity: 0.75 }}> {t('qInSet', { set: planLabel(project, q.inSetRev) })}</span>}
        </div>
      )}
    </div>
  )
}
