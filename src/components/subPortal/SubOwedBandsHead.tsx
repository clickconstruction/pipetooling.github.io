import type { CSSProperties } from 'react'
import { formatPortalUsd } from '../../lib/portal/portalPayload'
import { COPPER, HAIR, MUTED, PAPER_GREEN } from '../../lib/portal/portalTheme'
import { subOwedDayWords, type SubOwedBands, type SubOwedRow } from '../../lib/subPortal/subOwedBands'
import type { SubPortalLang, SubPortalStringKey } from '../../lib/subPortal/subPortalI18n'

/**
 * The sub's *Owed to you* as its rows (punch list #217, field-2, a prototype): the figure, then a
 * band for the next pay run with its day and a band for later in payable-after order, each row a
 * job and its amount, so the head's money is lines the sub can find among the cards. Reads
 * `subOwedBands` only; the words are the portal's strings in its language. Light only, as the page.
 */

type T = (key: SubPortalStringKey, vars?: Record<string, string>) => string

const BAND_HEAD: CSSProperties = { fontSize: 10.5, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', marginTop: 9, marginBottom: 2 }
const ROW: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, lineHeight: 1.5, fontVariantNumeric: 'tabular-nums' }
const SUM: CSSProperties = { ...ROW, fontWeight: 700, color: PAPER_GREEN, borderTop: `1px solid ${HAIR}`, marginTop: 2, paddingTop: 2 }

function Row({ words, amount, muted }: { words: string; amount: number; muted?: boolean }) {
  return (
    <div data-sub-owed-row style={{ ...ROW, color: muted ? MUTED : undefined }}>
      <span style={{ minWidth: 0 }}>{words}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{formatPortalUsd(amount)}</span>
    </div>
  )
}

export function SubOwedBandsHead({ bands, lang, t, payRunDayLabel }: { bands: SubOwedBands; lang: SubPortalLang; t: T; payRunDayLabel: string | null }) {
  const next = bands.nextRun
  return (
    <div data-testid="sub-owed-bands" style={{ textAlign: 'right', minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED }}>{t('owedToYou')}</div>
      <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{formatPortalUsd(bands.total)}</div>
      <div style={{ height: 3, background: COPPER, marginTop: 5 }} />
      <div style={{ textAlign: 'left' }}>
        {next && payRunDayLabel ? (
          <div data-sub-owed-band="next_run">
            <div style={{ ...BAND_HEAD, color: PAPER_GREEN }}>{t('bandNextRun', { day: payRunDayLabel, date: subOwedDayWords(next.ymd, lang) })}</div>
            {next.rows.length === 0 ? <div style={{ ...ROW, color: MUTED }}>{t('bandNothingInRun')}</div> : next.rows.map((r: SubOwedRow) => <Row key={r.id} words={r.jobWords} amount={r.amount} />)}
            {next.rows.length > 0 ? (
              <div data-sub-owed-sum style={SUM}>
                <span>{t('bandNextRunSum', { day: payRunDayLabel })}</span>
                <span>{formatPortalUsd(next.sum)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        {bands.later.rows.length > 0 || bands.unplaced > 0 ? (
          <div data-sub-owed-band="later">
            <div style={{ ...BAND_HEAD, color: MUTED }}>{t('bandLater')}</div>
            {bands.later.rows.map((r: SubOwedRow) => (
              <Row key={r.id} words={`${r.jobWords} · ${r.ymd ? t('bandPayableAfter', { date: subOwedDayWords(r.ymd, lang) }) : t('bandDateToCome')}`} amount={r.amount} />
            ))}
            {bands.unplaced > 0 ? <Row words={t('bandUnplaced')} amount={bands.unplaced} muted /> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
