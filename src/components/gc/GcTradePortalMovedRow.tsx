import { useState } from 'react'
import type { MovedRow } from '../../lib/gc/movedDatesRow'
import { MUTED } from '../../lib/portal/portalTheme'
import { Btn, Chip, input } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePortalPress, usePress } from './gcTradePortalPress'

/**
 * The trade's moved dates on its own schedule row (punch list #217, outside-13, a prototype): under the bar that
 * moved, beside the ghost of its old days, the reason as a chip — *moved 3 days later · weather · Two days of rain
 * held the drywall.* — and the two answers of *Your dates moved* (G-113), *These dates work* or *I need another day*
 * with the day and a word on why, posted as `answer_dates` the way the block posts them. Without a press provider
 * (the portal reads only) the chip draws alone, as the block is not drawn at all. The email keeps its words; the
 * page draws.
 */
export function GcTradePortalMovedRow({ row }: { row: MovedRow }) {
  const { t } = usePortalLang()
  const pressing = usePortalPress() !== null
  const { busy, problem, run } = usePress()
  const [asking, setAsking] = useState(false)
  const [day, setDay] = useState('')
  const [note, setNote] = useState('')
  const [thanked, setThanked] = useState(false)
  const answer = async (ok: boolean) => {
    if (await run('answer_dates', ok ? { moveId: row.moveId, ok } : { moveId: row.moveId, ok, day, note: note.trim() })) {
      setAsking(false)
      setThanked(true)
    }
  }
  return (
    <div data-portal-moved={row.lineId} data-portal-moved-direction={row.direction} style={{ display: 'grid', gap: '0.45rem', padding: '0.15rem 0 0.55rem', fontSize: '0.875rem' }}>
      <div>
        <Chip tone="amber" wrap title={row.work}>
          {row.chip}
        </Chip>
      </div>
      {pressing &&
        (thanked ? (
          <div>{t('datesThanks')}</div>
        ) : asking ? (
          <div style={{ display: 'grid', gap: '0.4rem', padding: '0.6rem', background: 'var(--bg-subtle)', borderRadius: 8 }}>
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{t('datesAnotherDay')}</span>
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label={t('datesAnotherDay')} style={input} />
            </label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('datesNote')} aria-label={t('datesNote')} style={{ ...input, width: '100%', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <Btn kind="primary" disabled={!day || busy} onClick={() => void answer(false)}>
                {t('datesSend')}
              </Btn>
              <Btn kind="quiet" onClick={() => setAsking(false)}>
                {t('notNow')}
              </Btn>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <Btn kind="primary" wrap disabled={busy} onClick={() => void answer(true)}>
              {t('datesWork')}
            </Btn>
            <Btn
              kind="plain"
              wrap
              onClick={() => {
                setAsking(true)
                setDay('')
                setNote('')
              }}
            >
              {t('datesAnother')}
            </Btn>
          </div>
        ))}
      {problem && <div style={{ color: MUTED, fontSize: '0.85rem' }}>{problem}</div>}
    </div>
  )
}
