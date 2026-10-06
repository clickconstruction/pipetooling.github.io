import { useId, useMemo, type CSSProperties } from 'react'
import { demandMoney } from '../../lib/jobsDocuments/demandLetter'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import {
  LIEN_OFFER_COUNSEL_NOTE,
  LIEN_OFFER_DEFAULT_DAYS,
  LIEN_OFFER_DEFAULT_PCT,
  LIEN_OFFER_PCTS,
  LIEN_OFFER_WORDING_READ_BY_COUNSEL,
  lienOfferCost,
  lienOfferDayProblem,
  lienOfferDefaultDay,
  lienOfferLatestDay,
  lienOfferSentence,
  type LienPayOffer,
} from '../../lib/jobs/lienPayOffer'

/**
 * The leader's pay offer box (v2.4708): on the notice he is about to approve, one switch —
 * *Offer a discount if a bill is paid in full by a day* — with the percent, the day and what
 * it costs at most, and the sentence as the pay page will print it. Controlled: the pane owns
 * the value and writes it with the approval (or, on an approved notice, through `onSave`).
 * Shows to the leader only; the guard trigger refuses anyone else anyway.
 */
type Props = {
  offer: LienPayOffer | null
  onChange: (offer: LienPayOffer | null) => void
  todayYmd: string
  /** The affidavit's file-by day for the job, when known: the offer never runs later than a week before it. */
  affidavitDueOn: string | null
  /** The payable bills' open amounts, for the cost line. */
  amounts: ReadonlyArray<number>
  disabled?: boolean
  /** On an approved notice: a Save button that writes now. */
  onSave?: () => void
  saving?: boolean
}

const small: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const pill = (on: boolean, disabled: boolean): CSSProperties => ({
  font: 'inherit',
  fontSize: '0.78rem',
  fontWeight: 600,
  padding: '2px 10px',
  borderRadius: 999,
  border: `1px solid ${on ? 'var(--border-blue)' : 'var(--border-strong)'}`,
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: on ? 'var(--text-blue-800)' : 'var(--text-700)',
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.6 : 1,
})

export default function LienOfferBox({ offer, onChange, todayYmd, affidavitDueOn, amounts, disabled = false, onSave, saving = false }: Props) {
  const id = useId()
  const on = offer != null
  const pct = offer?.pct ?? LIEN_OFFER_DEFAULT_PCT
  const defaultDay = useMemo(() => lienOfferDefaultDay(todayYmd, affidavitDueOn), [todayYmd, affidavitDueOn])
  const latest = useMemo(() => lienOfferLatestDay(affidavitDueOn), [affidavitDueOn])
  const by = offer?.by ?? defaultDay
  const problem = on ? lienOfferDayProblem(by, todayYmd, affidavitDueOn) : null
  const cost = lienOfferCost(amounts, pct)
  const set = (next: Partial<LienPayOffer>) => onChange({ pct, by, ...next })
  const dayPick: 'default' | 'latest' | 'own' = by === defaultDay ? 'default' : latest && by === latest ? 'latest' : 'own'

  return (
    <div data-testid="lien-offer-box" data-on={on ? 'yes' : 'no'} data-problem={problem ? 'yes' : undefined} style={{ display: 'grid', gap: 8, padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: disabled ? 'default' : 'pointer' }}>
        <input
          type="checkbox"
          checked={on}
          disabled={disabled}
          data-testid="lien-offer-switch"
          onChange={(e) => onChange(e.target.checked ? { pct: LIEN_OFFER_DEFAULT_PCT, by: defaultDay } : null)}
          style={{ marginTop: 3 }}
        />
        <span>
          <strong>Offer a discount if a bill is paid in full by a day</strong>
          <br />
          <span style={small}>Printed on the owner's pay page, never on the notice form. The claim stays the full amount.</span>
        </span>
      </label>
      {on ? (
        <div style={{ display: 'grid', gap: 8, paddingLeft: 24 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>Off the bill</span>
            <span role="group" aria-label="Percent off" style={{ display: 'inline-flex', gap: 4 }}>
              {LIEN_OFFER_PCTS.map((p) => (
                <button key={p} type="button" aria-pressed={pct === p} disabled={disabled} onClick={() => set({ pct: p })} style={pill(pct === p, disabled)} data-testid={`lien-offer-pct-${p}`}>
                  {p}%
                </button>
              ))}
            </span>
            {amounts.length ? (
              <span data-testid="lien-offer-cost" style={{ ...small, fontVariantNumeric: 'tabular-nums' }}>
                Up to {demandMoney(String(cost))} if {amounts.length === 1 ? 'it is' : `all ${amounts.length} are`} paid in time
              </span>
            ) : null}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ ...small, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.68rem' }}>Paid in full by</span>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="radio" name={`${id}-day`} checked={dayPick === 'default'} disabled={disabled} onChange={() => set({ by: defaultDay })} data-testid="lien-offer-day-default" />
              <span>
                {LIEN_OFFER_DEFAULT_DAYS} days from today · <strong>{formatYmdMonthDay(defaultDay)}</strong>
                {latest && defaultDay === latest ? <span style={small}> (pulled in: a week before the affidavit)</span> : null}
              </span>
            </label>
            {latest && latest !== defaultDay ? (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="radio" name={`${id}-day`} checked={dayPick === 'latest'} disabled={disabled} onChange={() => set({ by: latest })} data-testid="lien-offer-day-latest" />
                <span>
                  A week before the affidavit must be filed · <strong>{formatYmdMonthDay(latest)}</strong>
                </span>
              </label>
            ) : null}
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="radio" name={`${id}-day`} checked={dayPick === 'own'} disabled={disabled} onChange={() => undefined} data-testid="lien-offer-day-own" />
              <span>A day you pick</span>
              <input
                type="date"
                value={by}
                min={todayYmd}
                max={latest ?? undefined}
                disabled={disabled}
                aria-label="The offer's last day"
                data-testid="lien-offer-day-input"
                onChange={(e) => set({ by: e.target.value })}
                style={{ font: 'inherit', fontSize: '0.8125rem', padding: '2px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
              />
            </label>
            {problem ? (
              <span data-testid="lien-offer-problem" style={{ color: 'var(--text-red-600)', fontWeight: 600 }}>{problem}</span>
            ) : latest ? (
              <span style={small}>Never later than {formatYmdMonthDay(latest)}, so the affidavit can still go out on time if they do not pay.</span>
            ) : null}
          </div>
          <div data-testid="lien-offer-prints" style={{ borderLeft: '3px solid var(--border-blue)', padding: '4px 10px', background: 'var(--surface)' }}>
            <span style={{ ...small, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.68rem' }}>Prints on the pay page as</span>
            <div>{lienOfferSentence({ pct, by })}</div>
          </div>
          {!LIEN_OFFER_WORDING_READ_BY_COUNSEL ? (
            <span data-testid="lien-offer-counsel" style={{ color: 'var(--text-amber-800)', fontSize: '0.78rem' }}>
              {LIEN_OFFER_COUNSEL_NOTE} It is a settlement offer, not a waiver of the claim; the notice form is untouched.
            </span>
          ) : null}
          {onSave ? (
            <div>
              <button type="button" onClick={onSave} disabled={disabled || saving || Boolean(problem)} data-testid="lien-offer-save" style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 700, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Save the offer'}
              </button>
            </div>
          ) : null}
        </div>
      ) : onSave && !disabled ? (
        <div style={{ paddingLeft: 24 }}>
          <button type="button" onClick={onSave} disabled={saving} data-testid="lien-offer-save" style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 700, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
