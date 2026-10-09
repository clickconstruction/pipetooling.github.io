import { useEffect, useState } from 'react'
import { Btn, Chip, input } from './gcUi'
import {
  CHANGE_ORDER_REASON_WORDS,
  changeOrderPct,
  changeOrderPrice,
  changeOrderScheduleWords,
  changeOrderWho,
  contractDaysAdded,
  daysWords,
  projectChangeOrders,
} from '../../lib/gc/ownerBilling'
import type { ChangeOrderDraft } from '../../lib/gc/changeOrderRows'
import { substantialCompletionOn } from '../../lib/gc/schedule/schedule'
import { isTimeExtension, timeExtensionLines } from '../../lib/gc/timeExtension'
import type { ChangeOrder, ChangeOrderReason, GcProject, GcState } from '../../lib/gc/types'
import { money, shortDate } from '../../lib/gc/words'
import { emailedTo } from '../../lib/gc/customerEmail'

/**
 * GC mode, the real build, Owner Billing's O3-ui: change orders to the customer on real data, ported
 * from the prototype's `GcOwnerBillingChangeOrders.tsx` (branch spike/gc-mode). Draft one, send it,
 * record their answer, mark how much is done. The database's own functions check every step
 * (migration 20261008110000); the window only carries the press. Send's tick (O4b-2, off to start)
 * emails it to the customer to sign by reply; one sent without it shows the words to send from the
 * office's own email. A trade's ask for a change
 * joins here with the Portal's P4 (O3b).
 */

export interface ChangeOrderWrites {
  onDraft: (draft: ChangeOrderDraft) => void
  /** Send it for their signature; with `email`, email it to the customer too (O4b-2). */
  onSend: (changeOrderId: string, email: boolean) => void
  onAnswer: (changeOrderId: string, signed: boolean, on: string) => void
  onSetPct: (changeOrderId: string, pct: number) => void
  onDelete: (changeOrderId: string) => void
}

interface Props {
  state: GcState
  /** The project as the board maps it, its change orders laid over it. */
  project: GcProject
  today: string
  writes: ChangeOrderWrites
  /** The change order a write is working on, or 'new' for a draft. */
  busy?: string | null
  problem?: string | null
  /** Who each was emailed to and when, by id, read from its sent copies (O4b-2). */
  emailed?: Record<string, { to: string; on: string }[]>
  onClose: () => void
}

const PCT_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

export function GcChangeOrdersWindow({ state, project, today, writes, busy, problem, emailed = {}, onClose }: Props) {
  const [adding, setAdding] = useState(false)
  const all = projectChangeOrders(project)
  const signed = all.filter((co) => co.status === 'signed').reduce((s, co) => s + co.price, 0)
  const waiting = all.filter((co) => co.status === 'sent').length
  const days = contractDaysAdded(project)
  const finish = substantialCompletionOn(project)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name}: change orders`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(860px, 100%)', maxHeight: 'min(94vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · change orders</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              When the work changes, write it up and send it to {project.owner || 'the customer'} to sign. A signed one changes their price.
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>

        <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.6rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {signed !== 0 && <Chip tone="green">{`${signed > 0 ? '+' : '−'}${money(Math.abs(signed))} signed`}</Chip>}
            {days > 0 && <Chip tone="amber">{finish ? `+${daysWords(days)}: substantial completion ${shortDate(finish.on)}` : `+${daysWords(days)} to the job`}</Chip>}
            {waiting > 0 && <Chip tone="amber">{`${waiting} waiting on ${project.owner || 'the customer'}`}</Chip>}
            <span style={{ flex: 1 }} />
            {!adding && (
              <Btn kind="primary" onClick={() => setAdding(true)}>
                New change order
              </Btn>
            )}
          </div>

          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
              {problem}
            </div>
          )}

          {adding && (
            <NewChangeOrder
              project={project}
              busy={busy === 'new'}
              onSave={(draft) => {
                writes.onDraft(draft)
                setAdding(false)
              }}
              onCancel={() => setAdding(false)}
            />
          )}

          {all.length === 0 && !adding && <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No change orders yet.</div>}
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            {all.map((co) => (
              <ChangeOrderRow key={co.id} state={state} project={project} co={co} today={today} writes={writes} emailed={emailed[co.id] ?? []} busy={busy === co.id} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** What the office sends the customer from its own email when Send's tick was off: the change, its price and its days. */
function sendWords(project: GcProject, co: ChangeOrder): string {
  const price = isTimeExtension(co) ? 'No change to the price.' : `${co.price < 0 ? 'It takes' : 'It adds'} ${money(Math.abs(co.price))} ${co.price < 0 ? 'off' : 'to'} the price.`
  return `Change order ${co.number} for ${project.name}: ${co.description.trim().replace(/[.\s]+$/, '')}. ${price} It ${changeOrderScheduleWords(co)}. Please sign it and send it back.`
}

function ChangeOrderRow({
  state,
  project,
  co,
  today,
  writes,
  emailed,
  busy,
}: {
  state: GcState
  project: GcProject
  co: ChangeOrder
  today: string
  writes: ChangeOrderWrites
  emailed: { to: string; on: string }[]
  busy: boolean
}) {
  const [answerOn, setAnswerOn] = useState(today)
  // Off to start, as Bill the customer's: Send emails no one until it is ticked (O4b-2).
  const [emailIt, setEmailIt] = useState(false)
  const emailedLine = emailedTo(emailed)
  const credit = co.price < 0
  // A time extension (G-141): days only, already on the chart. No price, no work, so no % done.
  const timeOnly = isTimeExtension(co)
  const pct = changeOrderPct(project, co)
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.45rem', display: 'grid', gap: '0.25rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Change order {co.number}</strong>
        <span style={{ minWidth: 0 }}>{co.description}</span>
        <span style={{ flex: 1 }} />
        {timeOnly ? (
          <span style={{ color: 'var(--text-muted)' }}>no change to the price</span>
        ) : (
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{`${credit ? '−' : '+'}${money(Math.abs(co.price))}`}</strong>
        )}
      </div>
      {timeOnly ? (
        <>
          <div style={{ color: 'var(--text-muted)' }}>
            {CHANGE_ORDER_REASON_WORDS[co.reason]} · adds {daysWords(co.days ?? 0)} to the contract · its days are on the chart already
          </div>
          {timeExtensionLines(state, project, co).map((w) => (
            <div key={w}>{w}</div>
          ))}
        </>
      ) : (
        <div style={{ color: 'var(--text-muted)' }}>
          {CHANGE_ORDER_REASON_WORDS[co.reason]} · {changeOrderWho(state, project, co)} · {changeOrderScheduleWords(co)} ·{' '}
          {co.cost < 0 ? `saves us ${money(-co.cost)}` : `costs us ${money(co.cost)}`}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {co.status === 'draft' && (
          <>
            <Chip tone="grey">draft</Chip>
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input type="checkbox" checked={emailIt} onChange={(e) => setEmailIt(e.target.checked)} />
              Email it to the customer now
            </label>
            <Btn kind="primary" disabled={busy} onClick={() => writes.onSend(co.id, emailIt)}>
              Send for signature
            </Btn>
            <Btn kind="quiet" disabled={busy} onClick={() => writes.onDelete(co.id)}>
              Delete the draft
            </Btn>
          </>
        )}
        {co.status === 'sent' && (
          <>
            <Chip tone="amber">{`waiting on them since ${shortDate(co.sentOn)}`}</Chip>
            <input aria-label={`The day they answered change order ${co.number}`} type="date" value={answerOn} max={today} onChange={(e) => setAnswerOn(e.target.value)} style={input} />
            <Btn kind="primary" disabled={busy || answerOn === ''} onClick={() => writes.onAnswer(co.id, true, answerOn)}>
              They signed
            </Btn>
            <Btn kind="quiet" disabled={busy || answerOn === ''} onClick={() => writes.onAnswer(co.id, false, answerOn)}>
              They declined
            </Btn>
          </>
        )}
        {co.status === 'declined' && <Chip tone="red">{`declined ${shortDate(co.answeredOn)}`}</Chip>}
        {co.status === 'signed' && <Chip tone="green">{`signed ${shortDate(co.answeredOn)}`}</Chip>}
        {co.status === 'signed' && !timeOnly && pct.fromTrade && (
          <span>{`${changeOrderWho(state, project, co).replace(/ on .*$/, '')} reported ${pct.pct}% done in their portal. Its line on the bill follows their report.`}</span>
        )}
        {co.status === 'signed' && !timeOnly && !pct.fromTrade && (
          <>
            <select
              aria-label={`How much of change order ${co.number} is done`}
              value={co.pctDone}
              disabled={busy}
              onChange={(e) => writes.onSetPct(co.id, Number(e.target.value))}
              style={input}
            >
              {(PCT_STEPS.includes(co.pctDone) ? PCT_STEPS : [...PCT_STEPS, co.pctDone].sort((a, b) => a - b)).map((n) => (
                <option key={n} value={n}>
                  {n}% done
                </option>
              ))}
            </select>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Its line on the bill follows this.</span>
          </>
        )}
      </div>
      {emailedLine && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{emailedLine}</div>}
      {co.status === 'sent' && !emailedLine && (
        <div style={{ background: 'var(--surface-2, var(--surface))', border: '1px dashed var(--border)', borderRadius: 6, padding: '0.45rem 0.6rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>It went without an email. Send these words from your own email.</div>
          <div style={{ userSelect: 'all' }}>{sendWords(project, co)}</div>
        </div>
      )}
    </div>
  )
}

function NewChangeOrder({ project, busy, onSave, onCancel }: { project: GcProject; busy: boolean; onSave: (draft: ChangeOrderDraft) => void; onCancel: () => void }) {
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState<ChangeOrderReason>('owner')
  const [days, setDays] = useState('')
  const [packageId, setPackageId] = useState<string>(project.packages[0]?.id ?? '')
  const [credit, setCredit] = useState(false)
  const [cost, setCost] = useState('')
  const [price, setPrice] = useState('')
  const costNum = Math.abs(Number(cost) || 0) * (credit ? -1 : 1)
  const suggested = changeOrderPrice(project, costNum)
  const priceNum = price.trim() === '' ? suggested : Math.abs(Number(price) || 0) * (credit ? -1 : 1)
  const ready = description.trim() !== '' && costNum !== 0 && !busy
  const daysNum = Math.max(0, Math.round(Number(days) || 0))
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem', color: 'var(--text-muted)', minWidth: 0 } as const

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem', display: 'grid', gap: '0.6rem' }}>
      <label style={label}>
        Description of change
        <input style={{ ...input, width: '100%', minWidth: 0 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is changing, with the sheet if there is one" />
      </label>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <label style={label}>
          Reason
          <select style={input} value={reason} onChange={(e) => setReason(e.target.value as ChangeOrderReason)}>
            {(Object.keys(CHANGE_ORDER_REASON_WORDS) as ChangeOrderReason[]).map((r) => (
              <option key={r} value={r}>
                {CHANGE_ORDER_REASON_WORDS[r]}
              </option>
            ))}
          </select>
        </label>
        <label style={label}>
          Whose work
          <select style={input} value={packageId} onChange={(e) => setPackageId(e.target.value)}>
            {project.packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.trade}
              </option>
            ))}
            <option value="">Our own work</option>
          </select>
        </label>
        <label style={label}>
          Days it adds to the job
          <input style={{ ...input, width: '6rem' }} type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} placeholder="0" />
        </label>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <Btn kind={credit ? 'plain' : 'primary'} onClick={() => setCredit(false)}>
            Added work
          </Btn>
          <Btn kind={credit ? 'primary' : 'plain'} onClick={() => setCredit(true)}>
            Credit, work coming out
          </Btn>
        </div>
        <label style={label}>
          What it costs us
          <input style={{ ...input, width: '8rem' }} type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
        <label style={label}>
          {credit ? 'What comes off their price' : 'What it adds to their price'}
          <input style={{ ...input, width: '8rem' }} type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder={costNum === 0 ? '' : String(Math.abs(suggested))} />
        </label>
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>The price starts at the cost plus our {project.feePct}% fee. Type over it to change it.</div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Btn
          kind="primary"
          disabled={!ready}
          onClick={() => onSave({ description: description.trim(), reason, schedule: '', packageId: packageId === '' ? null : packageId, cost: costNum, price: priceNum, days: daysNum })}
        >
          Save the draft
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}
