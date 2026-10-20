import { useEffect, useState } from 'react'
import { AR_CAME_BACK_SENTENCE } from '../../../lib/jobs/arApplySentence'
import { arCaseDay, arCaseMoney, type ArReplacementDeposit, type ArReturnCaseView } from '../../../lib/jobs/arReturnCase'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'
import type { ArCaseFeeOffer } from '../../../lib/jobs/arReturnCaseFee'

export type ArCaseCloseReason = 'settled_other_way' | 'not_coming'

export type ArReturnCasePaneProps = {
  view: ArReturnCaseView
  todayYmd: string
  canApply: boolean
  /** A To match deposit that looks like the new check, when there is one. */
  replacement: ArReplacementDeposit | null
  busy: 'take_off' | 'close' | 'recorded' | 'unmark' | 'put_back' | 'fee' | null
  error: string | null
  onTakeOff: () => void
  onTheySaid: () => void
  onUseReplacement: () => void
  onClose: (reason: ArCaseCloseReason, note: string) => void
  onTakeRecordedOff: () => void
  onNotBounced: () => void
  /** v2.4950: a lost card dispute's one press. */
  onPutBack?: () => void
  /** v2.5033: the returned-check fee — the press, the fee once it is on, or why there is none. */
  fee?: ArCaseFeeOffer | null
  onAddFee?: () => void
  onOpenJob?: (jobId: string) => void
  /** Narrow layout: the list is behind this. */
  onBack?: () => void
}

const btn = (filled: boolean, red = false) => ({
  font: 'inherit',
  fontSize: '0.875rem',
  fontWeight: filled ? 600 : 500,
  padding: '0.5rem 1rem',
  minHeight: 44,
  borderRadius: 8,
  cursor: 'pointer',
  border: `1px solid ${filled ? (red ? '#b91c1c' : '#2563eb') : 'var(--border-strong)'}`,
  background: filled ? (red ? '#b91c1c' : '#2563eb') : 'var(--surface)',
  color: filled ? 'white' : 'var(--text-strong)',
})

const box = (tone: 'red' | 'amber' | 'blue' | 'green') =>
  ({
    red: { border: '1px solid var(--border-red)', background: 'var(--bg-red-tint)', color: 'var(--text-red-800)' },
    amber: { border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-900)' },
    blue: { border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', color: 'var(--text-strong)' },
    green: { border: '1px solid var(--border-green)', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' },
  })[tone]

/**
 * The case of a check that came back (v2.4325, punch list #76 PR 3), in place of the
 * deposit pane: what happened, what it costs, and one next step — take it off every
 * job it paid (read back first), get a new check (They said…), or deposit a rejected
 * check again. The new check is offered when it lands. More holds the rest.
 *
 * v2.4950: a card dispute or a failed bank debit on a Stripe bill shows here too, with a link to
 * it in Stripe. A lost dispute's one step is Put the bill back, read back first.
 */
export function ArReturnCasePane(props: ArReturnCasePaneProps) {
  const { view, todayYmd, canApply, replacement, busy } = props
  const [confirmingTakeOff, setConfirmingTakeOff] = useState(false)
  const [confirmingPutBack, setConfirmingPutBack] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [closing, setClosing] = useState<ArCaseCloseReason | null>(null)
  const [note, setNote] = useState('')
  useEffect(() => {
    setConfirmingTakeOff(false)
    setConfirmingPutBack(false)
    setMoreOpen(false)
    setClosing(null)
    setNote('')
  }, [view.id])

  const red = view.chip.tone === 'red'
  const takeOff = view.takeOff
  const jobsWord = takeOff && takeOff.jobs.length > 1 ? `all ${takeOff.jobs.length} jobs` : 'the job'

  return (
    <div data-testid="ar-return-case-pane" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.875rem' }}>
      {props.onBack ? (
        <button type="button" onClick={props.onBack} style={{ ...btn(false), alignSelf: 'flex-start', border: 'none', padding: '0.25rem 0', color: 'var(--text-link)' }}>
          ‹ Deposits
        </button>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-strong)' }}>{view.payer}</h3>
        <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{arCaseMoney(view.amount)}</span>
        <span
          style={{
            borderRadius: 999,
            fontSize: '0.75rem',
            padding: '1px 9px',
            background: red ? 'var(--surface)' : 'var(--bg-amber-tint)',
            color: red ? 'var(--text-red-700)' : 'var(--text-amber-800)',
            border: `1px solid ${red ? 'var(--border-red)' : 'var(--border-amber)'}`,
          }}
        >
          {view.chip.text}
        </span>
      </div>

      {view.handNote ? <div style={{ color: 'var(--text-muted)' }}>{view.handNote}</div> : null}

      <ol data-testid="ar-return-case-story" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {view.story.map((s, i) => (
          <li key={`${s.ymd}-${i}`} style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ width: 92, flexShrink: 0, color: s.tone === 'bad' ? 'var(--text-red-700)' : 'var(--text-muted)', fontWeight: s.tone === 'bad' ? 600 : 400 }}>{s.day}</span>
            <span style={{ color: s.tone === 'bad' ? 'var(--text-red-700)' : s.tone === 'good' ? 'var(--text-green-700)' : 'var(--text-700)', fontWeight: s.tone === 'bad' ? 600 : 400 }}>{s.text}</span>
          </li>
        ))}
      </ol>

      {view.stake ? (
        <div data-testid="ar-return-case-stake" style={{ ...box(view.stake.tone), borderRadius: 8, padding: '0.6rem 0.8rem' }}>
          <div style={{ fontWeight: 600 }}>{view.stake.text}</div>
          {view.stake.detail ? <div>{view.stake.detail}</div> : null}
          {view.stake.jobId && props.onOpenJob ? (
            <button type="button" onClick={() => props.onOpenJob?.(view.stake!.jobId!)} style={{ ...btn(false), border: 'none', background: 'transparent', padding: '0.2rem 0', color: 'var(--text-link)' }}>
              Open the job ›
            </button>
          ) : null}
        </div>
      ) : null}

      {replacement && canApply ? (
        <div data-testid="ar-return-case-replacement" style={{ ...box('green'), borderRadius: 8, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontWeight: 600 }}>
            This looks like the new check. {(replacement.counterparty_name ?? '').trim() || view.payer} · {arCaseMoney(Math.abs(Number(replacement.amount) || 0))} · {arCaseDay(calendarYmdInAppTzFromIso(String(replacement.posted_at ?? '')), todayYmd)}.
          </div>
          <div style={{ color: 'var(--text-700)' }}>Use it, and it goes on the bills this check paid. Then the case closes.</div>
          <div>
            <button type="button" onClick={props.onUseReplacement} style={btn(true)}>
              Use it as the new check
            </button>
          </div>
        </div>
      ) : null}

      <div data-testid="ar-return-case-next" style={{ ...box('blue'), borderRadius: 8, padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-blue-800)' }}>Next</div>
        <div data-testid="ar-return-case-next-sentence" style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-strong)' }}>
          {view.next.sentence}
        </div>

        {view.next.kind === 'take_off' && takeOff && canApply ? (
          confirmingTakeOff ? (
            <div data-testid="ar-return-case-readback" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '0.5rem 0.75rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>What changes</div>
              {takeOff.jobs.map((j) => (
                <div key={j.jobId} style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <span style={{ minWidth: 180, flex: '0 0 auto', fontWeight: 500 }}>{j.label}</span>
                  <span style={{ flex: '1 1 200px' }}>
                    {j.words}
                    {j.blocker ? <span style={{ display: 'block', color: 'var(--text-red-700)', fontWeight: 600 }}>{j.blocker}</span> : null}
                  </span>
                </div>
              ))}
              <div style={{ padding: '0.5rem 0.75rem', color: 'var(--text-700)' }}>{takeOff.summary}</div>
              <div style={{ display: 'flex', gap: '0.5rem', padding: '0 0.75rem 0.75rem', flexWrap: 'wrap' }}>
                <button type="button" data-testid="ar-return-case-takeoff-confirm" disabled={takeOff.blocked || busy != null} onClick={props.onTakeOff} style={{ ...btn(true, true), opacity: takeOff.blocked || busy != null ? 0.5 : 1, cursor: takeOff.blocked || busy != null ? 'not-allowed' : 'pointer' }}>
                  {busy === 'take_off' ? 'Taking it off…' : `Take it off ${jobsWord}`}
                </button>
                <button type="button" onClick={() => setConfirmingTakeOff(false)} disabled={busy != null} style={btn(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" data-testid="ar-return-case-takeoff" onClick={() => setConfirmingTakeOff(true)} style={btn(true, true)}>
                Take it off {jobsWord}
              </button>
            </div>
          )
        ) : null}

        {view.next.kind === 'new_check' && canApply ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {view.promiseJob ? (
              <button type="button" data-testid="ar-return-case-they-said" onClick={props.onTheySaid} style={btn(true)}>
                They said…
              </button>
            ) : null}
          </div>
        ) : null}

        {(view.next.kind === 'answer_dispute' || view.next.kind === 'new_payment') && (view.stripe || (canApply && view.promiseJob)) ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {view.stripe ? (
              <a data-testid="ar-return-case-stripe" href={view.stripe.url} target="_blank" rel="noreferrer" style={{ ...btn(view.next.kind === 'answer_dispute'), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                {view.stripe.label}
              </a>
            ) : null}
            {canApply && view.promiseJob ? (
              <button type="button" data-testid="ar-return-case-they-said" onClick={props.onTheySaid} style={btn(view.next.kind === 'new_payment')}>
                They said…
              </button>
            ) : null}
          </div>
        ) : null}

        {view.next.kind === 'put_back' && view.putBack && canApply && props.onPutBack ? (
          confirmingPutBack ? (
            <div data-testid="ar-return-case-putback-readback" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '0.5rem 0.75rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>What changes</div>
              {view.putBack.words.map((w) => (
                <div key={w} style={{ padding: '0.4rem 0.75rem' }}>
                  {w}
                </div>
              ))}
              <div style={{ padding: '0.4rem 0.75rem', color: 'var(--text-700)' }}>The job's history keeps the removal and who did it.</div>
              <div style={{ display: 'flex', gap: '0.5rem', padding: '0 0.75rem 0.75rem', flexWrap: 'wrap' }}>
                <button type="button" data-testid="ar-return-case-putback-confirm" disabled={busy != null} onClick={props.onPutBack} style={{ ...btn(true, true), opacity: busy != null ? 0.5 : 1, cursor: busy != null ? 'not-allowed' : 'pointer' }}>
                  {busy === 'put_back' ? 'Putting it back…' : 'Put the bill back'}
                </button>
                <button type="button" onClick={() => setConfirmingPutBack(false)} disabled={busy != null} style={btn(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" data-testid="ar-return-case-putback" onClick={() => setConfirmingPutBack(true)} style={btn(true, true)}>
                Put the bill back
              </button>
              {view.stripe ? (
                <a href={view.stripe.url} target="_blank" rel="noreferrer" style={{ ...btn(false), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  {view.stripe.label}
                </a>
              ) : null}
            </div>
          )
        ) : null}

        {view.next.kind === 'deposit_again' && canApply && view.recorded ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setClosing('settled_other_way')} style={btn(false)}>
              It was paid another way
            </button>
            <button type="button" data-testid="ar-return-case-recorded-off" disabled={busy != null} onClick={props.onTakeRecordedOff} style={btn(false)}>
              {busy === 'recorded' ? 'Taking it off…' : `Take the ${arCaseMoney(view.recorded.amount)} off ${view.recorded.label.split(' ')[0]}`}
            </button>
          </div>
        ) : null}

        {view.watch ? <div style={{ color: 'var(--text-700)' }}>{view.watch}</div> : null}

        {canApply ? (
          <div style={{ position: 'relative' }}>
            <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} style={{ ...btn(false), padding: '0.35rem 0.75rem' }}>
              More ▾
            </button>
            {moreOpen ? (
              <div role="menu" style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, maxWidth: 320 }}>
                <button type="button" role="menuitem" onClick={() => { setClosing('settled_other_way'); setMoreOpen(false) }} style={{ ...btn(false), border: 'none', textAlign: 'left' }}>
                  Settled another way…
                </button>
                <button type="button" role="menuitem" onClick={() => { setClosing('not_coming'); setMoreOpen(false) }} style={{ ...btn(false), border: 'none', textAlign: 'left' }}>
                  Not coming…
                </button>
                {view.source === 'hand' ? (
                  <button type="button" role="menuitem" disabled={busy != null} onClick={() => { setMoreOpen(false); props.onNotBounced() }} style={{ ...btn(false), border: 'none', textAlign: 'left' }}>
                    It did not bounce
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {closing ? (
          <div data-testid="ar-return-case-close" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontWeight: 600 }}>{closing === 'settled_other_way' ? 'How was it settled?' : 'Why is no new check coming?'}</div>
            <label htmlFor="ar-return-case-note" style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              A note for the record
            </label>
            <input
              id="ar-return-case-note"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder={closing === 'settled_other_way' ? 'Paid by card on Oct 3' : 'Written off with the owner'}
              style={{ font: 'inherit', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6 }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" data-testid="ar-return-case-close-confirm" disabled={busy != null} onClick={() => props.onClose(closing, note)} style={btn(true)}>
                {busy === 'close' ? 'Closing…' : closing === 'settled_other_way' ? 'Close it as settled' : 'Close it as not coming'}
              </button>
              <button type="button" onClick={() => setClosing(null)} style={btn(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {props.fee ? (
        <div data-testid="ar-return-case-fee" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Returned check fee</div>
          <div data-testid="ar-return-case-fee-line" title={props.fee.title} style={{ alignSelf: 'flex-start', color: 'var(--text-700)', textDecoration: 'underline dotted', textUnderlineOffset: 3, cursor: 'help' }}>
            {props.fee.line}
          </div>
          {props.fee.kind !== 'added' && props.fee.note ? (
            <div data-testid="ar-return-case-fee-note" style={{ color: 'var(--text-amber-800)' }}>
              {props.fee.note}
            </div>
          ) : null}
          {props.fee.kind === 'offer' ? (
            canApply && props.onAddFee ? (
              <div>
                <button type="button" data-testid="ar-return-case-fee-add" disabled={busy != null} onClick={props.onAddFee} title={props.fee.title} style={btn(false)}>
                  {busy === 'fee' ? 'Adding the fee…' : props.fee.button}
                </button>
              </div>
            ) : null
          ) : (
            <div data-testid="ar-return-case-fee-words" style={{ color: props.fee.kind === 'added' ? 'var(--text-green-700)' : 'var(--text-muted)' }}>
              {props.fee.words}
            </div>
          )}
        </div>
      ) : null}

      {props.error ? <div style={{ color: 'var(--text-red-700)' }}>{props.error}</div> : null}

      <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
        {view.source === 'unbanked'
          ? 'The case closes when the payment is linked to its deposit, when it comes off the job, or under More.'
          : view.source === 'stripe_dispute'
            ? 'The case closes when Stripe decides for us, when the bill is put back, or under More.'
            : view.source === 'stripe_debit'
              ? 'The case closes when the bill is paid or voided, or under More.'
              : `${AR_CAME_BACK_SENTENCE} The case closes when the new check is on the bill, or under More.`}
      </div>
    </div>
  )
}
