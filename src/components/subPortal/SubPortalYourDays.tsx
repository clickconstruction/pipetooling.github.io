/**
 * "Your days" on the sub portal (v2.2930): weekday cells for the coming
 * weeks, each saying how many jobs land on it ("one job", "two jobs") or
 * "off"; a tap opens that day's list with addresses and a Map link, and
 * "Mark this day off" lives inside it so a booked day warns before it is
 * taken off. The DAY is the unit — a sub can be on several jobs in one day.
 */
import { useMemo, useState } from 'react'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER, PAPER_GREEN, PAPER_RED } from '../../lib/portal/portalTheme'
import { formatSubPortalDate, type SubPortalLang, type SubPortalStringKey } from '../../lib/subPortal/subPortalI18n'
import { mapsUrlFor, subPortalDayCountWord, subPortalDayItems, subPortalMonthCells, subPortalOffDayCollisions, type SubPortalDays } from '../../lib/subPortal/subPortalDays'

type T = (key: SubPortalStringKey, vars?: Record<string, string>) => string

export type SubPortalYourDaysProps = {
  days: SubPortalDays
  todayYmd: string
  lang: SubPortalLang
  t: T
  /** Posts `day_off`; resolves ok / an error sentence. Sample mode passes a no-op that resolves ok. */
  onToggleOff: (day: string, off: boolean) => Promise<{ ok: boolean; error?: string }>
}

const DOW_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DOW_ES = ['lun', 'mar', 'mié', 'jue', 'vie']
const MON_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function SubPortalYourDays({ days, todayYmd, lang, t, onToggleOff }: SubPortalYourDaysProps) {
  const [offDays, setOffDays] = useState<Set<string>>(() => new Set(days.offDays))
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const live = useMemo(() => ({ bookings: days.bookings, offDays: [...offDays] }), [days.bookings, offDays])
  const rows = useMemo(() => subPortalMonthCells(live, todayYmd, 5, todayYmd), [live, todayYmd])
  const month = (lang === 'es' ? MON_ES : MON_EN)[Number(todayYmd.slice(5, 7)) - 1]
  const year = todayYmd.slice(0, 4)
  const dow = lang === 'es' ? DOW_ES : DOW_EN
  const items = open ? subPortalDayItems(live, open) : []
  const isOff = open ? offDays.has(open) : false
  const collisions = open ? subPortalOffDayCollisions(live, open) : []

  async function toggle() {
    if (!open) return
    setBusy(true)
    setError(null)
    const next = !isOff
    const res = await onToggleOff(open, next)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Something went wrong. Please try again, or call the office.')
      return
    }
    setOffDays((prev) => {
      const s = new Set(prev)
      if (next) s.add(open)
      else s.delete(open)
      return s
    })
    setToast(next ? t('markedOff') : t('dayTakenBack'))
    setTimeout(() => setToast(null), 1800)
  }

  return (
    <div data-testid="sub-your-days" style={{ background: CARD, border: `1px solid ${HAIR}`, borderRadius: 10, overflow: 'hidden' }} data-avoid-break>
      <div style={{ background: PAPER, padding: '0.5rem 0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: `1px solid ${HAIR}` }}>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{t('yourDays')}</span>
        <span style={{ fontSize: 12, color: MUTED }}>{t('yourDaysHint')}</span>
      </div>
      <div style={{ padding: '0.65rem 0.9rem 0.8rem' }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: MUTED, marginBottom: 6 }}>{lang === 'es' ? `${month} de ${year}` : `${month} ${year}`}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 5, fontSize: 12.5 }}>
          {dow.map((d) => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: FAINT }}>
              {d}
            </div>
          ))}
          {rows.flat().map((c) => {
            const n = c.items.length
            const line = c.off ? t('dayOff') : n > 0 ? subPortalDayCountWord(n, lang) : ''
            const opened = open === c.day
            return (
              <button
                key={c.day}
                type="button"
                onClick={() => setOpen(opened ? null : c.day)}
                aria-pressed={opened}
                aria-label={c.day}
                title={c.items.map((i) => i.label).join(', ')}
                style={{
                  minHeight: 46,
                  borderRadius: 7,
                  border: `1px solid ${HAIR}`,
                  boxShadow: opened ? `inset 0 0 0 2px ${COPPER}` : c.day === todayYmd ? `inset 0 0 0 2px ${INK}` : 'none',
                  background: c.off ? `repeating-linear-gradient(45deg, #eeeae0 0 4px, ${CARD} 4px 8px)` : n > 0 ? '#eeeae0' : CARD,
                  color: c.off ? FAINT : c.past ? FAINT : INK,
                  opacity: c.past && !c.off && n === 0 ? 0.55 : 1,
                  cursor: 'pointer',
                  padding: '5px 2px 4px',
                  lineHeight: 1.1,
                  fontFamily: 'inherit',
                  position: 'relative',
                }}
              >
                <span style={{ display: 'block', fontSize: 13, fontWeight: n > 0 ? 700 : 500 }}>{Number(c.day.slice(8))}</span>
                <span style={{ display: 'block', fontSize: 9.5, fontWeight: 600, color: n > 0 && !c.off ? INK : FAINT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 2px' }}>{line}</span>
                {n > 1 && !c.off ? <span aria-hidden style={{ position: 'absolute', left: 8, right: 8, bottom: 2, height: 3, borderRadius: 2, background: `linear-gradient(90deg, ${FAINT} 0 45%, transparent 45% 55%, ${FAINT} 55%)` }} /> : null}
              </button>
            )
          })}
        </div>

        {open ? (
          <div data-testid="sub-day-sheet" style={{ marginTop: 10, border: `1px solid ${HAIR}`, borderRadius: 8, background: PAPER, padding: '10px 12px', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <b style={{ fontSize: 14 }}>
                {formatSubPortalDate(open, lang)} · {isOff ? t('daySheetOff') : items.length > 0 ? t(items.length === 1 ? 'daySheetJobs' : 'daySheetJobsPlural', { n: String(items.length) }) : t('daySheetNothing')}
              </b>
              <button type="button" onClick={() => { setOpen(null); setError(null) }} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>
                {t('close')}
              </button>
            </div>
            {items.map((it) => (
              <div key={it.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 10px', alignItems: 'start', padding: '8px 10px', background: CARD, border: `1px solid ${HAIR}`, borderLeft: `3px solid ${it.source === 'pick' ? COPPER : FAINT}`, borderRadius: 8 }}>
                <div>
                  <b style={{ display: 'block', fontSize: 13.5 }}>{it.label}</b>
                  {it.address ? <div style={{ fontSize: 12.5 }}>{it.address}</div> : null}
                </div>
                {it.address ? (
                  <a href={mapsUrlFor(it.address)} target="_blank" rel="noopener" style={{ fontSize: 12, fontWeight: 700, color: '#1d4e89', whiteSpace: 'nowrap', border: '1px solid #1d4e89', borderRadius: 6, padding: '4px 8px', textDecoration: 'none' }}>
                    {t('mapLink')}
                  </a>
                ) : <span />}
                <div style={{ gridColumn: '1 / -1', fontSize: 11.5, color: MUTED }}>
                  {it.source === 'pick' ? t('yourDatesTag') : t('setByOffice')} · {it.span.start === it.span.end ? formatSubPortalDate(it.span.start, lang) : `${formatSubPortalDate(it.span.start, lang)} – ${formatSubPortalDate(it.span.end, lang)}`}{it.note ? ` · ${it.note}` : ''}
                </div>
              </div>
            ))}
            {items.length === 0 && !isOff ? <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{t('daySheetEmpty')}</div> : null}
            {isOff ? <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{t('daySheetIsOff')}</div> : null}
            {error ? <div style={{ color: PAPER_RED, fontSize: 12.5 }}>{error}</div> : null}
            {open >= todayYmd ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} data-screen-only>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggle()}
                  style={{ background: !isOff && items.length === 0 ? COPPER : CARD, color: !isOff && items.length === 0 ? '#fff' : INK, border: `1px solid ${!isOff && items.length === 0 ? COPPER : HAIR}`, borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: 13, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
                >
                  {busy ? '…' : isOff ? t('takeBack') : t('markOff')}
                </button>
                {!isOff && collisions.length > 0 ? <span style={{ fontSize: 12, color: '#a86a00', fontWeight: 700 }}>{t('bookedWarn')}</span> : null}
                {toast ? <span style={{ fontSize: 12, color: PAPER_GREEN, fontWeight: 700 }}>{toast}</span> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: MUTED, marginTop: 8 }}>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#eeeae0', border: `1px solid ${HAIR}`, marginRight: 4, verticalAlign: -1 }} />{t('legendBooked')}</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: `repeating-linear-gradient(45deg, #eeeae0 0 3px, ${CARD} 3px 6px)`, border: `1px solid ${HAIR}`, marginRight: 4, verticalAlign: -1 }} />{t('legendOff')}</span>
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>{t('yourDaysFoot')}</div>
      </div>
    </div>
  )
}

export default SubPortalYourDays
