import { useState } from 'react'
import { pDate } from '../../lib/gc/portalI18n'
import { MUTED } from '../../lib/portal/portalTheme'
import type { WorkDates } from '../../../supabase/functions/_shared/gcTradePortalSchedule'
import { Btn, Chip, input } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePress } from './gcTradePortalPress'
import { PortalBlock } from './GcTradePortalUi'

/**
 * GC mode, the trade partner portal's P5d-ii-2 (to-dos/gc-mode/mockups/portal-p5d.md): "Your dates moved" (G-113),
 * lifted from the design spike's `GcPortalDatesMoved.tsx` onto `gc-trade-portal`'s answer. The office told the company
 * its days changed; here is the message, rebuilt in its language, with two answers: the dates work, or it needs another
 * day, with the day and a word on why (`answer_dates`). Its kernel runs on the server, so this is a lift of the screen,
 * not word for word. One block per job, anchored `dates` for Needs you.
 */
export function GcTradePortalDatesMoved({ dates }: { dates: WorkDates[] }) {
  const { lang, t } = usePortalLang()
  const { busy, problem, run } = usePress()
  const [asking, setAsking] = useState<string | null>(null)
  const [day, setDay] = useState('')
  const [note, setNote] = useState('')
  const [thanked, setThanked] = useState(false)
  if (dates.length === 0 && !thanked) return null
  const answer = async (moveId: string, ok: boolean) => {
    if (await run('answer_dates', ok ? { moveId, ok } : { moveId, ok, day, note: note.trim() })) {
      setAsking(null)
      setThanked(true)
    }
  }
  return (
    <div data-portal-anchor="dates" style={{ scrollMarginTop: '0.5rem' }}>
      <PortalBlock title={t('datesMoved')}>
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          {thanked && dates.length === 0 && <div style={{ fontSize: '0.875rem' }}>{t('datesThanks')}</div>}
          {dates.map((n) => (
            <div key={n.moveId} data-portal-dates={n.moveId} style={{ display: 'grid', gap: '0.45rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <Chip tone="grey">{pDate(lang, n.toldOn)}</Chip>
                <strong>{n.subject}</strong>
              </div>
              {n.lines.map((line) => (
                <div key={line}>{line}</div>
              ))}
              {asking === n.moveId ? (
                <div style={{ display: 'grid', gap: '0.4rem', padding: '0.6rem', background: 'var(--bg-subtle)', borderRadius: 8 }}>
                  <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>{t('datesAnotherDay')}</span>
                    <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label={t('datesAnotherDay')} style={input} />
                  </label>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('datesNote')} aria-label={t('datesNote')} style={{ ...input, width: '100%', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Btn kind="primary" disabled={!day || busy} onClick={() => void answer(n.moveId, false)}>
                      {t('datesSend')}
                    </Btn>
                    <Btn kind="quiet" onClick={() => setAsking(null)}>
                      {t('notNow')}
                    </Btn>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <Btn kind="primary" wrap disabled={busy} onClick={() => void answer(n.moveId, true)}>
                    {t('datesWork')}
                  </Btn>
                  <Btn
                    kind="plain"
                    wrap
                    onClick={() => {
                      setAsking(n.moveId)
                      setDay('')
                      setNote('')
                    }}
                  >
                    {t('datesAnother')}
                  </Btn>
                </div>
              )}
            </div>
          ))}
          {problem && <div style={{ color: MUTED, fontSize: '0.85rem' }}>{problem}</div>}
        </div>
      </PortalBlock>
    </div>
  )
}
