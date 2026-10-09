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
import type { ChangeOrderDraft, ChangeRequestDraft } from '../../lib/gc/changeOrderRows'
import { partnerById } from '../../lib/gc/lookups'
import { openChangeRequests } from '../../lib/gc/portal'
import { substantialCompletionOn } from '../../lib/gc/schedule/schedule'
import { isTimeExtension, timeExtensionLines } from '../../lib/gc/timeExtension'
import { changeAskEmailKey } from '../../lib/gc/tradeEmail'
import type { ChangeOrder, ChangeOrderReason, GcProject, GcState, TradeChangeRequest } from '../../lib/gc/types'
import { money, shortDate } from '../../lib/gc/words'
import { emailedTo } from '../../lib/gc/customerEmail'

/**
 * GC mode, the real build, Owner Billing's O3-ui: change orders to the customer on real data, ported
 * from the prototype's `GcOwnerBillingChangeOrders.tsx` (branch spike/gc-mode). Draft one, send it,
 * record their answer, mark how much is done. The database's own functions check every step
 * (migration 20261008110000); the window only carries the press. Send's tick (O4b-2, off to start)
 * emails it to the customer to sign by reply; one sent without it shows the words to send from the
 * office's own email. A trade's ask for a change (the Portal's P4) is answered here (O3b, migration
 * 20261010014000): made a change order on its own trade and reason, or turned down with why, and the
 * company hears each step by email.
 */

export interface ChangeOrderWrites {
  onDraft: (draft: ChangeOrderDraft) => void
  /** Send it for their signature; with `email`, email it to the customer too (O4b-2). */
  onSend: (changeOrderId: string, email: boolean) => void
  onAnswer: (changeOrderId: string, signed: boolean, on: string) => void
  onSetPct: (changeOrderId: string, pct: number) => void
  onDelete: (changeOrderId: string) => void
  /** Make a trade's ask a draft change order (O3b). */
  onDraftFromRequest: (requestId: string, draft: ChangeRequestDraft) => void
  /** Turn a trade's ask down with why, and email the company (O3b). */
  onTurnDown: (requestId: string, note: string) => void
  /** Email the company where its ask stands, when that email has not gone: sent to the customer, or the customer said no. */
  onTell: (requestId: string, stage: 'sent' | 'no') => void
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
  /** The day each email about a trade's ask went to its company, by its key `<request id>:<stage>` (O3b). */
  askEmailed?: Record<string, string>
  onClose: () => void
}

const PCT_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

export function GcChangeOrdersWindow({ state, project, today, writes, busy, problem, emailed = {}, askEmailed = {}, onClose }: Props) {
  const [adding, setAdding] = useState(false)
  const all = projectChangeOrders(project)
  const signed = all.filter((co) => co.status === 'signed').reduce((s, co) => s + co.price, 0)
  const waiting = all.filter((co) => co.status === 'sent').length
  const days = contractDaysAdded(project)
  const finish = substantialCompletionOn(project)
  // A trade's asks for a change (the Portal's P4): the ones we have not answered.
  const asks = openChangeRequests(project)

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
            {asks.length > 0 && <Chip tone="red">{`${asks.length} asked by the trades`}</Chip>}
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

          {asks.length > 0 && (
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              {asks.map((r) => (
                <ChangeRequestRow key={r.id} state={state} project={project} request={r} writes={writes} busy={busy === r.id} />
              ))}
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
              <ChangeOrderRow
                key={co.id}
                state={state}
                project={project}
                co={co}
                today={today}
                writes={writes}
                emailed={emailed[co.id] ?? []}
                askEmailed={askEmailed}
                busy={busy === co.id}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * A trade's ask for a change, waiting on us (O3b, the prototype's `ChangeRequestRow`): make it a change order (its words,
 * its amount as our cost, its days; the price starts at the cost plus our fee) or turn it down with why.
 */
function ChangeRequestRow({ state, project, request: r, writes, busy }: { state: GcState; project: GcProject; request: TradeChangeRequest; writes: ChangeOrderWrites; busy: boolean }) {
  const [open, setOpen] = useState<'make' | 'down' | null>(null)
  const [description, setDescription] = useState(r.description)
  const [cost, setCost] = useState(String(r.amount))
  const [price, setPrice] = useState('')
  const [days, setDays] = useState(String(r.days))
  const [note, setNote] = useState('')
  const company = partnerById(state, r.partnerId)?.company ?? 'A trade'
  const trade = project.packages.find((k) => k.id === r.packageId)?.trade ?? ''
  const costNum = Math.round(Number(cost) || 0)
  const daysNum = Math.max(0, Math.round(Number(days) || 0))
  const suggested = changeOrderPrice(project, costNum)
  // The press sends the price it shows: the one typed, else the cost plus our fee.
  const priceNum = price.trim() === '' ? suggested : Math.round(Number(price) || 0)
  const ready = description.trim() !== '' && costNum !== 0 && !busy
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: 0 } as const

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.65rem', display: 'grid', gap: '0.3rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip tone="red">asked by the trade</Chip>
        <strong>{company}</strong>
        <span style={{ color: 'var(--text-muted)' }}>
          {trade} · asked {shortDate(r.askedOn)}
        </span>
        <span style={{ flex: 1 }} />
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(r.amount)}</strong>
      </div>
      <div>{r.description}</div>
      <div style={{ color: 'var(--text-muted)' }}>
        {CHANGE_ORDER_REASON_WORDS[r.reason]} · {r.days > 0 ? `adds ${daysWords(r.days)} to the job` : 'no days added'}
        {r.file ? (
          <>
            {' · '}
            <a href={r.file} target="_blank" rel="noreferrer">
              the file it sent
            </a>
          </>
        ) : null}
      </div>
      {open === null && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Btn kind="primary" disabled={busy} onClick={() => setOpen('make')}>
            Make a change order
          </Btn>
          <Btn disabled={busy} onClick={() => setOpen('down')}>
            Turn down
          </Btn>
        </div>
      )}
      {open === 'make' && (
        <div style={{ display: 'grid', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
          <label style={label}>
            Description of change
            <input style={{ ...input, width: '100%', minWidth: 0 }} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={label}>
              What it costs us
              <input style={{ ...input, width: '8rem' }} type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
            </label>
            <label style={label}>
              What it adds to their price
              <input
                style={{ ...input, width: '8rem' }}
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={costNum === 0 ? '' : String(Math.abs(suggested))}
              />
            </label>
            <label style={label}>
              Days it adds to the job
              <input style={{ ...input, width: '6rem' }} type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} />
            </label>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Their ask is our cost. The price starts at the cost plus our {project.feePct}% fee. {company} only ever sees the cost.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Btn
              kind="primary"
              disabled={!ready}
              onClick={() => {
                writes.onDraftFromRequest(r.id, { description: description.trim(), cost: costNum, price: priceNum, days: daysNum })
                setOpen(null)
              }}
            >
              Save the draft
            </Btn>
            <Btn kind="quiet" onClick={() => setOpen(null)}>
              Cancel
            </Btn>
          </div>
        </div>
      )}
      {open === 'down' && (
        <div style={{ display: 'grid', gap: '0.35rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ ...label, flex: '1 1 16rem' }}>
              Why, for {company}
              <input style={{ ...input, width: '100%', minWidth: 0 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="It is in your scope, sheet S-201." />
            </label>
            <Btn
              kind="primary"
              disabled={note.trim() === '' || busy}
              onClick={() => {
                writes.onTurnDown(r.id, note.trim())
                setOpen(null)
              }}
            >
              Turn it down
            </Btn>
            <Btn kind="quiet" onClick={() => setOpen(null)}>
              Cancel
            </Btn>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{company} gets an email with why.</div>
        </div>
      )}
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
  askEmailed,
  busy,
}: {
  state: GcState
  project: GcProject
  co: ChangeOrder
  today: string
  writes: ChangeOrderWrites
  emailed: { to: string; on: string }[]
  askEmailed: Record<string, string>
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
  // Made of a trade's ask (O3b): who asked, and what the company has heard of it since.
  const asked = (project.changeRequests ?? []).find((r) => r.changeOrderId === co.id)
  const askedBy = asked ? (partnerById(state, asked.partnerId)?.company ?? 'the trade') : ''
  const tellStage = co.status === 'sent' ? 'sent' : co.status === 'declined' ? 'no' : null
  const toldOn = asked && tellStage ? askEmailed[changeAskEmailKey(asked.id, tellStage)] : undefined
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
      {asked && (
        <div style={{ color: 'var(--text-muted)' }}>
          Asked for by {askedBy} on {shortDate(asked.askedOn)}: {money(asked.amount)}.
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
            {asked && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{`Deleting it puts ${askedBy}’s ask back on the list.`}</span>}
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
        {co.status === 'declined' && <Chip tone="red">{`declined ${shortDate(co.answeredOn)}${co.answeredInPortal ? ' in their portal' : ''}`}</Chip>}
        {co.status === 'declined' && co.declinedNote && <span>{`Their reason: ${co.declinedNote}`}</span>}
        {co.status === 'signed' && <Chip tone="green">{`signed ${shortDate(co.answeredOn)}${co.answeredInPortal ? ' in their portal' : ''}`}</Chip>}
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
      {asked && tellStage && toldOn && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {tellStage === 'sent' ? `Told ${askedBy} ${shortDate(toldOn)}.` : `Told ${askedBy} the customer said no.`}
        </div>
      )}
      {asked && tellStage && !toldOn && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {tellStage === 'sent' ? `${askedBy} has not heard it went to ${project.owner || 'the customer'}.` : `${askedBy} has not heard the customer said no.`}
          </span>
          <Btn disabled={busy} onClick={() => writes.onTell(asked.id, tellStage)}>
            {`Tell ${askedBy}`}
          </Btn>
        </div>
      )}
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
