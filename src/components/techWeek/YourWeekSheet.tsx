import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { parseMyCustomerWords, wordsInWeek } from '../../lib/ratings/ratingCredit'
import { payWeekContaining } from '../../lib/payWeekAnchor'
import { hoursThisWeek, weekSheetSeenKey, weekSheetWords, type WeekSheetWords } from '../../lib/techWeek/weekSheet'
import { parseMyWeek, yourWeekCard } from '../../lib/techWeek/weekSignal'
import { supabaseYourWeekIo, type YourWeekIo } from '../../lib/techWeek/yourWeekIo'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * The sheet after the week's last clock-out (punch list #255, v2.6606): the week said once, at the moment the work
 * stops. The clock-out and the week's hours, the signal and where it stands, the move, the customer's words, and one
 * press, **Have a good weekend**. Reads `my_week()` and `my_customer_words()` as the Your week card does; closes
 * itself when the office has picked no signal. Remembered on this device so it deals once a week.
 */

const BACKDROP: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1150, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'var(--app-top-chrome, 0px) 0 env(safe-area-inset-bottom)' }
const SHEET: CSSProperties = { width: 'min(520px, 100%)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: '14px 14px 0 0', padding: '1rem 1.1rem 1.1rem', display: 'grid', gap: 10, boxShadow: '0 -8px 30px rgba(0,0,0,0.25)' }
const MUTED: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)' }
const BIG: CSSProperties = { fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }
const GREEN = '#16a34a'
const STARS_ON = '#f59e0b'
const PRESS: CSSProperties = { font: 'inherit', fontSize: '0.95rem', fontWeight: 700, padding: '0.6rem 1rem', minHeight: 44, borderRadius: 10, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer', width: '100%' }

function pillStyle(tone: 'up' | 'flat' | 'none'): CSSProperties {
  const up = tone === 'up'
  return { display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: 999, fontSize: '0.82rem', fontWeight: 700, background: up ? 'var(--bg-green-tint)' : 'var(--bg-subtle)', color: up ? 'var(--text-green-800)' : 'var(--text-muted)', border: `1px solid ${up ? GREEN : 'var(--border)'}` }
}

export function rememberWeekSheet(userId: string, weekStartYmd: string): void {
  try {
    localStorage.setItem(weekSheetSeenKey(userId, weekStartYmd), new Date().toISOString())
  } catch {
    /* a private window: the sheet may deal again, which is fine */
  }
}

export function weekSheetAlreadyDealt(userId: string, weekStartYmd: string): boolean {
  try {
    return Boolean(localStorage.getItem(weekSheetSeenKey(userId, weekStartYmd)))
  } catch {
    return false
  }
}

export function YourWeekSheet({ open, userId, clockedOutIso, onClose, io: ioIn }: { open: boolean; userId: string; clockedOutIso: string; onClose: () => void; io?: YourWeekIo }) {
  const io = useMemo(() => ioIn ?? supabaseYourWeekIo(), [ioIn])
  const [words, setWords] = useState<WeekSheetWords | null>(null)

  useEffect(() => {
    if (!open || !userId) return
    let live = true
    const today = todayYmdInAppTz()
    const week = payWeekContaining(today)
    void Promise.all([io.myWeek(), io.myWords().catch(() => [])]).then(
      ([rawWeek, rawWords]) => {
        if (!live) return
        const my = parseMyWeek(rawWeek)
        const card = my ? yourWeekCard(my, today) : null
        if (!my || !card) {
          onClose()
          return
        }
        const quote = wordsInWeek(parseMyCustomerWords(rawWords), week).find((w) => w.words) ?? null
        setWords(weekSheetWords(card, quote, clockedOutIso, hoursThisWeek(my, week), today))
        rememberWeekSheet(userId, week.start)
      },
      () => live && onClose(),
    )
    return () => {
      live = false
    }
  }, [open, userId, io, clockedOutIso, onClose])

  if (!open || !words) return null
  return (
    <div style={BACKDROP} role="presentation" onClick={onClose}>
      <section style={SHEET} role="dialog" aria-modal="true" aria-label={words.title} data-testid="your-week-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{words.title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'inherit' }}>
            ×
          </button>
        </div>
        <div style={MUTED}>{words.clockLine}</div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-700)' }}>{words.kicker}</div>
        <div style={BIG}>{words.head}</div>
        {words.sub ? <div style={MUTED}>{words.sub}</div> : null}
        {words.move.text ? (
          <div>
            <span style={pillStyle(words.move.tone)}>{words.move.text}</span>
          </div>
        ) : null}
        {words.mark ? <div style={MUTED}>{words.mark}</div> : null}
        {words.note ? <div style={MUTED}>{words.note}</div> : null}
        {words.quote ? (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'grid', gap: 4 }}>
            <span aria-label={`${words.quote.stars} stars`} style={{ color: STARS_ON, letterSpacing: 1 }}>
              {'★'.repeat(words.quote.stars)}
            </span>
            <div style={{ fontSize: '0.95rem' }}>“{words.quote.words}”</div>
            <div style={MUTED}>{words.quote.who}</div>
          </div>
        ) : null}
        <button type="button" style={PRESS} onClick={onClose}>
          {words.button}
        </button>
      </section>
    </div>
  )
}

export default YourWeekSheet
