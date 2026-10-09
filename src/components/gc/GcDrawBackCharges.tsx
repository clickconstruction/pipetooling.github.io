import { useEffect, useRef, useState } from 'react'
import { Btn, Chip, input, type Tone } from './gcUi'
import { backChargeCanTake, backChargeDraws, backChargeState, BACK_CHARGE_ANSWER_DAYS, type BackChargeState } from '../../lib/gc/portal'
import type { BackCharge, Sow } from '../../lib/gc/types'
import { money, shortDate, weekdayDate } from '../../lib/gc/words'

/**
 * GC mode, the real build, the Building lane's U6b: back-charges, the office's side, ported from the prototype's
 * `GcBuildingBackCharges.tsx` (branch spike/gc-mode). We charge a trade an amount, what it is for and a photo's link.
 * They agree or dispute it in their portal within BACK_CHARGE_ANSWER_DAYS. A dispute is ours to keep or drop, with a
 * reason. An agreed or kept charge, or one with no answer by its day, comes off an approved draw before we pay it.
 * The record and its rules are the Portal lane's (P4a's `gc_back_charges`, `portal.ts`); taking one off a draw is
 * U6a's `gc_take_back_charge`.
 */

const STATE: Record<BackChargeState, { tone: Tone; word: string }> = {
  open: { tone: 'blue', word: 'waiting on their answer' },
  noAnswer: { tone: 'amber', word: 'no answer by its day' },
  agreed: { tone: 'green', word: 'they agreed' },
  disputed: { tone: 'red', word: 'they dispute it' },
  kept: { tone: 'amber', word: 'we kept it' },
  dropped: { tone: 'grey', word: 'dropped' },
  taken: { tone: 'green', word: 'taken off a draw' },
}

const box = { ...input, height: 30, boxSizing: 'border-box', padding: '0 0.45rem' } as const

export interface BackChargeWrites {
  onCharge: (charge: { amount: number; reason: string; photoUrl: string }) => void
  onSettle: (chargeId: string, keep: boolean, note: string) => void
  onTake: (chargeId: string, drawId: string) => void
}

export function GcDrawBackCharges({
  sow,
  company,
  today,
  litChargeId = null,
  busy = null,
  emailOn = false,
  writes,
}: {
  sow: Sow
  company: string
  today: string
  /** The window's email tick: a charge sent emails them only when it is on. */
  emailOn?: boolean
  /** The charge a link opened the window at (`&charge=<id>`, the dashboard's Needs you): outlined and scrolled to. */
  litChargeId?: string | null
  /** The charge a press works on, or 'new' for one being sent. */
  busy?: string | null
  writes: BackChargeWrites
}) {
  const charges = sow.backCharges ?? []
  const [adding, setAdding] = useState(false)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [photo, setPhoto] = useState('')
  if (sow.status !== 'signed') return null
  const dollars = Number(amount.replace(/[$,\s]/g, ''))
  const ok = Number.isFinite(dollars) && dollars > 0 && reason.trim() !== ''
  const send = () => {
    if (!ok) return
    writes.onCharge({ amount: Math.round(dollars * 100) / 100, reason: reason.trim(), photoUrl: photo.trim() })
    setAmount('')
    setReason('')
    setPhoto('')
    setAdding(false)
  }
  return (
    <div data-draw-charges style={{ display: 'grid', gap: '0.4rem', marginTop: '0.3rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong>Back-charges</strong>
        {charges.length === 0 && <span style={{ color: 'var(--text-muted)' }}>None.</span>}
        {!adding && (
          <Btn kind="quiet" onClick={() => setAdding(true)} disabled={busy === 'new'}>
            Charge them
          </Btn>
        )}
      </div>
      {adding && (
        <div style={{ display: 'grid', gap: '0.4rem', padding: '0.55rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount, like 1,250" aria-label="Amount" style={{ ...box, width: '9rem' }} />
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What it is for, like cut the temporary power line" aria-label="What it is for" style={{ ...box, flex: '2 1 16rem' }} />
            <input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="A photo's link, if you have one" aria-label="A photo's link" style={{ ...box, flex: '1 1 10rem' }} />
          </div>
          <span data-draw-charge-hint style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {emailOn
              ? `${company} gets an email and has ${BACK_CHARGE_ANSWER_DAYS} days to agree or dispute it.`
              : `${company} has ${BACK_CHARGE_ANSWER_DAYS} days to agree or dispute it. With the email tick off, tell them yourself.`}{' '}
            With no answer by then, it can come off a draw.
          </span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <Btn kind="primary" disabled={!ok || busy === 'new'} title={ok ? undefined : 'Say how much and what for first.'} onClick={send}>
              Send the charge
            </Btn>
            <Btn kind="quiet" onClick={() => setAdding(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      )}
      {charges.map((c) => (
        <ChargeLine key={c.id} sow={sow} charge={c} today={today} lit={c.id === litChargeId} busy={busy === c.id} writes={writes} />
      ))}
    </div>
  )
}

function ChargeLine({ sow, charge, today, lit, busy, writes }: { sow: Sow; charge: BackCharge; today: string; lit: boolean; busy: boolean; writes: BackChargeWrites }) {
  const st = backChargeState(charge, today)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (lit && typeof ref.current?.scrollIntoView === 'function') ref.current.scrollIntoView({ block: 'center' })
  }, [lit])
  const [settling, setSettling] = useState<'keep' | 'drop' | null>(null)
  const [note, setNote] = useState('')
  const canTake = backChargeCanTake(charge, today)
  const draws = canTake ? backChargeDraws(sow, charge) : []
  const takenFrom = charge.taken ? sow.draws.find((d) => d.id === charge.taken?.drawId) : undefined
  let detail: string
  if (st === 'taken') detail = `Taken off draw ${takenFrom?.number ?? ''} ${shortDate(charge.taken?.on ?? null)}.`
  else if (st === 'open') detail = `Sent ${shortDate(charge.sentOn)}. They answer by ${weekdayDate(charge.answerBy)}.`
  else if (st === 'noAnswer') detail = `Sent ${shortDate(charge.sentOn)}. No answer by ${shortDate(charge.answerBy)}, so it can come off a draw.`
  else if (st === 'agreed') detail = `They agreed ${shortDate(charge.answer?.on ?? null)}.`
  else if (st === 'disputed') detail = `They dispute it${charge.answer?.note ? `: "${charge.answer.note}"` : '.'}`
  else if (st === 'kept') detail = `We kept it ${shortDate(charge.settled?.on ?? null)}${charge.settled?.note ? `: ${charge.settled.note}` : '.'}`
  else detail = `Dropped ${shortDate(charge.settled?.on ?? null)}${charge.settled?.note ? `: ${charge.settled.note}` : '.'}`
  const settle = () => {
    if (!settling || note.trim() === '') return
    writes.onSettle(charge.id, settling === 'keep', note.trim())
    setSettling(null)
    setNote('')
  }
  const live = st !== 'taken' && st !== 'dropped'
  const photoIsLink = charge.photo ? /^https?:\/\//i.test(charge.photo) : false
  return (
    <div
      ref={ref}
      data-charge={charge.id}
      data-charge-state={st}
      style={{ display: 'grid', gap: '0.3rem', padding: '0.45rem 0.6rem', border: lit ? '2px solid var(--border-blue)' : '1px solid var(--border)', borderRadius: 8 }}
    >
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(charge.amount)}</strong>
        <span>{charge.reason}</span>
        {charge.photo &&
          (photoIsLink ? (
            <a href={charge.photo} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem' }}>
              Photo
            </a>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Photo {charge.photo}</span>
          ))}
        <Chip tone={STATE[st].tone}>{STATE[st].word}</Chip>
      </div>
      <span style={{ color: st === 'disputed' ? 'var(--text-red-700)' : 'var(--text-muted)', fontSize: '0.82rem' }}>{detail}</span>
      {live && !settling && (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {draws.map((d) => (
            <Btn key={d.id} kind="primary" disabled={busy} onClick={() => writes.onTake(charge.id, d.id)}>
              Take it off draw {d.number}
            </Btn>
          ))}
          {canTake && draws.length === 0 && (
            <span data-charge-no-draw style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No approved draw can take it yet. It can come off their next one once we approve it.
            </span>
          )}
          {(st === 'disputed' || st === 'noAnswer') && (
            <Btn disabled={busy} onClick={() => setSettling('keep')}>
              Keep it
            </Btn>
          )}
          <Btn kind="quiet" disabled={busy} onClick={() => setSettling('drop')}>
            Drop it
          </Btn>
        </div>
      )}
      {settling && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={settling === 'keep' ? 'Why we keep it, for them to read' : 'Why we drop it'}
            aria-label={settling === 'keep' ? 'Why we keep it' : 'Why we drop it'}
            style={{ ...box, flex: '1 1 16rem' }}
          />
          <Btn kind="primary" disabled={busy || note.trim() === ''} title={note.trim() === '' ? 'Say why first.' : undefined} onClick={settle}>
            {settling === 'keep' ? 'Keep it' : 'Drop it'}
          </Btn>
          <Btn
            kind="quiet"
            onClick={() => {
              setSettling(null)
              setNote('')
            }}
          >
            Cancel
          </Btn>
        </div>
      )}
    </div>
  )
}
