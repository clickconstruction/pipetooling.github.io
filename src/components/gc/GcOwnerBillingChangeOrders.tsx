import { useState, type Dispatch } from 'react'
import { Btn, Card, Chip, input } from './gcUi'
import {
  CHANGE_ORDER_REASON_WORDS,
  changeOrderPct,
  changeOrderPrice,
  changeOrderScheduleWords,
  changeOrderWho,
  contractDaysAdded,
  daysWords,
  money,
  projectChangeOrders,
  shortDate,
  substantialCompletionOn,
  type ChangeOrder,
  type ChangeOrderReason,
  type GcAction,
  type GcProject,
  type GcState,
} from '../../lib/gcMode/gcModel'

const PCT_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

/**
 * GC mode design spike: change orders to the owner, on Bill the owner. Draft one, send it, and
 * the owner signs or declines it in their portal. A signed one raises their price and is a line of
 * its own on our bill; its percent done is marked here until the trade's statement of work carries it.
 */
export function GcOwnerBillingChangeOrders({ state, project, dispatch }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction> }) {
  const [adding, setAdding] = useState(false)
  const all = projectChangeOrders(project)
  const signed = all.filter((co) => co.status === 'signed').reduce((s, co) => s + co.price, 0)
  const waiting = all.filter((co) => co.status === 'sent').length
  const days = contractDaysAdded(project)
  const finish = substantialCompletionOn(project)

  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
        <strong style={{ fontSize: '1.05rem' }}>Change orders</strong>
        {signed !== 0 && <Chip tone="green">{`${signed > 0 ? '+' : '−'}${money(Math.abs(signed))} signed`}</Chip>}
        {days > 0 && (
          <Chip tone="amber">{finish ? `+${daysWords(days)}: substantial completion ${shortDate(finish.on)}` : `+${daysWords(days)} to the job`}</Chip>
        )}
        {waiting > 0 && <Chip tone="amber">{`${waiting} waiting on ${project.owner}`}</Chip>}
        <span style={{ flex: 1 }} />
        {!adding && <Btn onClick={() => setAdding(true)}>New change order</Btn>}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.6rem' }}>
        When the work changes, write it up and send it to {project.owner} to sign. A signed one changes their price and gets
        its own line on the bill.
      </div>

      {adding && <NewChangeOrder project={project} dispatch={dispatch} onDone={() => setAdding(false)} />}

      {all.length === 0 && !adding && <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No change orders yet.</div>}
      <div style={{ display: 'grid', gap: '0.45rem' }}>
        {all.map((co) => (
          <ChangeOrderRow key={co.id} state={state} project={project} co={co} dispatch={dispatch} />
        ))}
      </div>
    </Card>
  )
}

function ChangeOrderRow({ state, project, co, dispatch }: { state: GcState; project: GcProject; co: ChangeOrder; dispatch: Dispatch<GcAction> }) {
  const ids = { projectId: project.id, changeOrderId: co.id }
  const credit = co.price < 0
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.45rem', display: 'grid', gap: '0.25rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Change order {co.number}</strong>
        <span>{co.description}</span>
        <span style={{ flex: 1 }} />
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{`${credit ? '−' : '+'}${money(Math.abs(co.price))}`}</strong>
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        {CHANGE_ORDER_REASON_WORDS[co.reason]} · {changeOrderWho(state, project, co)} · {changeOrderScheduleWords(co)} · costs us{' '}
        {money(co.cost)}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {co.status === 'draft' && (
          <>
            <Chip tone="grey">draft</Chip>
            <Btn kind="primary" onClick={() => dispatch({ type: 'sendChangeOrder', ...ids })} title={`It goes to ${project.owner} to sign in their portal.`}>
              Send for signature
            </Btn>
          </>
        )}
        {co.status === 'sent' && <Chip tone="amber">{`waiting on them since ${shortDate(co.sentOn)}`}</Chip>}
        {co.status === 'declined' && <Chip tone="red">{`declined ${shortDate(co.answeredOn)}`}</Chip>}
        {co.status === 'signed' && changeOrderPct(project, co).fromTrade && (
          <>
            <Chip tone="green">{`signed ${shortDate(co.answeredOn)}`}</Chip>
            <span>
              {`${changeOrderWho(state, project, co).replace(/ on .*$/, '')} reported ${changeOrderPct(project, co).pct}% done in their portal.`}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Its line on the bill follows their report.</span>
          </>
        )}
        {co.status === 'signed' && !changeOrderPct(project, co).fromTrade && (
          <>
            <Chip tone="green">{`signed ${shortDate(co.answeredOn)}`}</Chip>
            <select
              aria-label={`How much of change order ${co.number} is done`}
              value={co.pctDone}
              onChange={(e) => dispatch({ type: 'setChangeOrderPct', ...ids, pct: Number(e.target.value) })}
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
    </div>
  )
}

function NewChangeOrder({ project, dispatch, onDone }: { project: GcProject; dispatch: Dispatch<GcAction>; onDone: () => void }) {
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
  const ready = description.trim() !== '' && costNum !== 0
  const daysNum = Math.max(0, Math.round(Number(days) || 0))
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem', color: 'var(--text-muted)' } as const

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem', display: 'grid', gap: '0.6rem', marginBottom: '0.6rem' }}>
      <label style={label}>
        Description of change
        <input
          style={input}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is changing, with the sheet if there is one"
        />
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
        <div style={{ display: 'flex', gap: '0.35rem' }}>
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
          <input
            style={{ ...input, width: '8rem' }}
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={costNum === 0 ? '' : String(Math.abs(suggested))}
          />
        </label>
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        The price starts at the cost plus our {project.feePct}% fee. Type over it to change it.
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Btn
          kind="primary"
          disabled={!ready}
          onClick={() => {
            dispatch({
              type: 'draftChangeOrder',
              projectId: project.id,
              description,
              reason,
              schedule: '',
              packageId: packageId === '' ? null : packageId,
              cost: costNum,
              price: priceNum,
              days: daysNum,
            })
            onDone()
          }}
        >
          Save the draft
        </Btn>
        <Btn kind="quiet" onClick={onDone}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}
