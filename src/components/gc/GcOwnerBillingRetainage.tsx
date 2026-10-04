import { useState, type Dispatch } from 'react'
import { Btn, Card, input } from './gcUi'
import {
  OWNER_RETAINAGE_DEFAULT_PCT,
  money,
  ownerPayApp,
  ownerRetainageOn,
  ownerRetainageWords,
  type GcAction,
  type GcProject,
  type GcState,
  type OwnerRetainageStep,
} from '../../lib/gcMode/gcModel'

type Way = 'end' | OwnerRetainageStep['way']

/**
 * GC mode design spike: what the owner holds back, on Bill the owner. Whether it drops partway is
 * ours to offer and to choose per job (the owner, 2026-10-04): held to the end, or a lower percent
 * once the work is far enough along, on the rest or on all of it.
 */
export function GcOwnerBillingRetainage({ state, project, dispatch }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction> }) {
  const full = state.customers.find((c) => c.id === project.customerId)?.retainagePct ?? OWNER_RETAINAGE_DEFAULT_PCT
  const step = project.ownerRetainageStep
  const [open, setOpen] = useState(false)
  const [way, setWay] = useState<Way>(step?.way ?? 'end')
  const [at, setAt] = useState(String(step?.atPct ?? 50))
  const [to, setTo] = useState(String(step?.toPct ?? full / 2))
  const app = ownerPayApp(state, project)
  const atNum = Number(at)
  const toNum = Number(to)
  const chosen: OwnerRetainageStep | null = way === 'end' ? null : { atPct: atNum, toPct: toNum, way }
  const ready = chosen === null || (atNum > 0 && atNum < 100 && toNum >= 0 && toNum < full)
  const holdNow = app.retainage
  const holdChosen = ownerRetainageOn(full, chosen ?? undefined, app.doneToDate, app.contract)
  const label = { display: 'flex', gap: '0.45rem', alignItems: 'baseline', fontSize: '0.875rem', cursor: 'pointer' } as const
  const small = { ...input, width: '4rem', padding: '0.2rem 0.35rem' }
  const reset = () => {
    setWay(step?.way ?? 'end')
    setAt(String(step?.atPct ?? 50))
    setTo(String(step?.toPct ?? full / 2))
    setOpen(false)
  }
  const numbers = (
    <>
      once the work is <input style={small} type="number" min={1} max={99} value={at} onChange={(e) => setAt(e.target.value)} />% done, to{' '}
      <input style={small} type="number" min={0} max={full} step={0.5} value={to} onChange={(e) => setTo(e.target.value)} />%
    </>
  )

  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '1.05rem' }}>Retainage</strong>
        <span style={{ flex: 1 }} />
        {!open && (
          <Btn kind="quiet" onClick={() => setOpen(true)}>
            Change
          </Btn>
        )}
      </div>
      <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
        {project.owner} holds {ownerRetainageWords(full, step)}. Today that is {money(holdNow)}.
      </div>

      {open && (
        <div style={{ marginTop: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', display: 'grid', gap: '0.5rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            It is ours to offer. Pick what the contract with {project.owner} says.
          </div>
          <label style={label}>
            <input type="radio" name={`ret-${project.id}`} checked={way === 'end'} onChange={() => setWay('end')} />
            <span>{full}% until the end.</span>
          </label>
          <label style={label}>
            <input type="radio" name={`ret-${project.id}`} checked={way === 'after'} onChange={() => setWay('after')} />
            <span>
              It drops {way === 'after' ? numbers : `once the work is half done, to ${full / 2}%`} on the work after that. What they held stays held.
            </span>
          </label>
          <label style={label}>
            <input type="radio" name={`ret-${project.id}`} checked={way === 'all'} onChange={() => setWay('all')} />
            <span>
              It drops {way === 'all' ? numbers : `once the work is half done, to ${full / 2}%`} on all of it. Some of what they held comes back.
            </span>
          </label>
          {ready && Math.abs(holdChosen - holdNow) > 0.5 && (
            <div style={{ fontSize: '0.85rem' }}>
              On the next bill they would hold {money(holdChosen)}, not {money(holdNow)}.
              {holdChosen < holdNow && ` That is ${money(holdNow - holdChosen)} more on the bill.`}
            </div>
          )}
          {!ready && <div style={{ fontSize: '0.85rem', color: 'var(--text-red-700)' }}>Pick a point between 1% and 99% done, and a percent below {full}%.</div>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Btn
              kind="primary"
              disabled={!ready}
              onClick={() => {
                dispatch({ type: 'setOwnerRetainageStep', projectId: project.id, step: chosen })
                setOpen(false)
              }}
            >
              Save
            </Btn>
            <Btn kind="quiet" onClick={reset}>
              Cancel
            </Btn>
          </div>
        </div>
      )}
    </Card>
  )
}
