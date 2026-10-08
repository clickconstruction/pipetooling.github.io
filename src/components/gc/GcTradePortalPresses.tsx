import { useState } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import { portalPromiseLine } from '../../lib/gc/portal'
import { pWeekday } from '../../lib/gc/portalI18n'
import type { Invite, ScopeItem } from '../../lib/gc/types'
import { HAIR } from '../../lib/portal/portalTheme'
import { Btn, input } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePress } from './gcTradePortalPress'
import { PortalNote } from './GcTradePortalUi'

/**
 * GC mode, the trade partner portal's presses on an ask (P2b-ii), from the design spike's BidBlock in
 * `GcTradePortal.tsx`, `GcPortalBidExtras.tsx` (AnswerLines) and `GcPortalQuestions.tsx`. Each posts its kind to
 * `submit-gc-trade-portal` and the page reads the slice again; a refusal shows under the press in the company's words.
 */

const GC = GC_COMPANY.shortName
const PROBLEM = { color: 'var(--text-red-700)', fontSize: '0.8rem' } as const

/** The day the quote will come, or a new one once that day passed (tradePromise). Before a quote is in. */
export function QuoteDay({ invite, today }: { invite: Invite; today: string }) {
  const { lang, t } = usePortalLang()
  const { busy, problem, run } = usePress()
  const [day, setDay] = useState('')
  const promise = portalPromiseLine(invite, today, GC, lang)
  return (
    <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: '0.5rem', display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }}>
      {promise ? <span style={promise.late ? { color: 'var(--text-red-700)', fontWeight: 600 } : undefined}>{promise.text}</span> : <span>{t('notReady', { gc: GC })}</span>}
      <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" min={today} value={day} onChange={(e) => setDay(e.target.value)} style={input} aria-label={t('dayAria')} />
        <Btn
          disabled={day === '' || busy}
          onClick={() => {
            void run('quote_day', { inviteId: invite.id, by: day }).then((ok) => ok && setDay(''))
          }}
        >
          {promise?.late ? t('giveNewDay') : promise ? t('changeDay') : t('tellGc', { gc: GC })}
        </Btn>
      </span>
      {problem && <span style={PROBLEM}>{problem}</span>}
    </div>
  )
}

/** Pass on the ask (tradeDecline), before a quote is in. */
export function PassOnAsk({ invite }: { invite: Invite }) {
  const { t } = usePortalLang()
  const { busy, problem, run } = usePress()
  return (
    <span style={{ display: 'grid', gap: '0.2rem' }}>
      <span>
        <Btn kind="quiet" disabled={busy} onClick={() => void run('decline', { inviteId: invite.id })}>
          {t('passOn')}
        </Btn>
      </span>
      {problem && <span style={PROBLEM}>{problem}</span>}
    </span>
  )
}

/** A newer set changed the trade after it was priced: the number stands on it (tradeConfirmBid), once the newest is open. */
export function ConfirmQuote({ invite, openedNewest }: { invite: Invite; openedNewest: boolean }) {
  const { t } = usePortalLang()
  const { busy, problem, run } = usePress()
  return (
    <PortalNote tone="amber">
      <div>
        {t('staleNote')} {t(openedNewest ? 'staleOpened' : 'staleNotOpened')}
      </div>
      <div>
        <Btn kind="primary" disabled={!openedNewest || busy} title={openedNewest ? undefined : t('openFirst')} onClick={() => void run('confirm_quote', { inviteId: invite.id })}>
          {t('confirmStands')}
        </Btn>
      </div>
      {problem && <div style={PROBLEM}>{problem}</div>}
    </PortalNote>
  )
}

/** The lines the office could not read: in the number or left out, each (tradeAnswerLines). */
export function AnswerLines({ invite, items }: { invite: Invite; items: ScopeItem[] }) {
  const { t } = usePortalLang()
  const { busy, problem, run } = usePress()
  const [open, setOpen] = useState(false)
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no'>>({})
  const done = items.every((item) => answers[item.id] !== undefined)
  if (!open) {
    return (
      <PortalNote tone="amber">
        <div>{t('unclearAsk', { gc: GC, items: items.map((i) => i.label.charAt(0).toLowerCase() + i.label.slice(1)).join(t('or')) })}</div>
        <div>
          <Btn kind="primary" onClick={() => setOpen(true)}>
            {t('answerIt')}
          </Btn>
        </div>
      </PortalNote>
    )
  }
  return (
    <PortalNote tone="amber">
      <div>{t('answerIntro', { gc: GC })}</div>
      {items.map((item) => (
        <div key={item.id} style={{ display: 'grid', gap: '0.3rem' }}>
          <strong>{item.label}</strong>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <Btn kind={answers[item.id] === 'yes' ? 'primary' : 'plain'} onClick={() => setAnswers({ ...answers, [item.id]: 'yes' })}>
              {t('inMyNumber')}
            </Btn>
            <Btn kind={answers[item.id] === 'no' ? 'primary' : 'plain'} onClick={() => setAnswers({ ...answers, [item.id]: 'no' })}>
              {t('leftOut')}
            </Btn>
          </div>
        </div>
      ))}
      {problem && <div style={PROBLEM}>{problem}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={!done || busy} onClick={() => void run('answer_lines', { inviteId: invite.id, answers }).then((ok) => ok && setOpen(false))}>
          {t('sendAnswer')}
        </Btn>
        <Btn kind="quiet" disabled={busy} onClick={() => setOpen(false)}>
          {t('notNow')}
        </Btn>
      </div>
    </PortalNote>
  )
}

/** Ask about the plans of a trade (tradeAskQuestion), until questions close. */
export function AskQuestion({ packageId, closeOn }: { packageId: string; closeOn: string | null }) {
  const { lang, t } = usePortalLang()
  const { busy, problem, run } = usePress()
  const [text, setText] = useState('')
  const [sheets, setSheets] = useState('')
  const send = async () => {
    if (await run('ask_question', { packageId, text: text.trim(), sheets: sheets.split(/[\s,]+/).filter(Boolean) })) {
      setText('')
      setSheets('')
    }
  }
  return (
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
        style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
      />
      <input style={{ ...input, width: '100%', boxSizing: 'border-box' }} value={sheets} onChange={(e) => setSheets(e.target.value)} placeholder={t('questionSheets')} aria-label={t('questionSheets')} />
      {problem && <div style={PROBLEM}>{problem}</div>}
      <div>
        <Btn kind="primary" disabled={text.trim() === '' || busy} onClick={() => void send()}>
          {t('sendQuestion')}
        </Btn>
      </div>
    </div>
  )
}
