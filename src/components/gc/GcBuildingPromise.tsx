import { useState, type Dispatch, type ReactNode } from 'react'
import {
  addDays,
  papersOwed,
  papersOwedWords,
  openPromiseFor,
  PROMISE_WHAT,
  tradePromisesOf,
  tradePromiseState,
  tradePromiseWords,
  type BuildingPromiseKind,
  type GcAction,
  type GcProject,
  type GcState,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import { Btn, input } from './gcUi'

/** The boxes at the height of the button beside them (the owner, 2026-10-04): a date input runs taller on its own. */
const box = { ...input, height: 30, boxSizing: 'border-box', padding: '0 0.45rem' } as const

/** A kept promise shows under the thing this many days, then only on the company's word record. */
const KEPT_SHOWN_DAYS = 7

/** The button that opens the date, before anything is written down. */
const ASK: Record<BuildingPromiseKind, string> = {
  start: 'They gave a start day',
  submittals: 'They gave a day to send them',
  delivery: 'They gave a delivery day',
  payApp: 'They gave a day to send it again',
  punch: 'They gave a day to fix them',
  closeout: 'They gave a day for the papers',
}

/**
 * GC mode design spike: a day a trade gave us, written down where the thing lives (the owner,
 * 2026-10-04, question 8). One line on the Board's promise record: write the day down, move it,
 * or, for a delivery the app cannot see, mark it came. The rest are kept when the trade does it.
 */
export function GcBuildingPromise({
  state,
  project,
  pkg,
  kind,
  what,
  askWhat = false,
  ask = true,
  note,
  dispatch,
}: {
  state: GcState
  project: GcProject
  pkg: TradePackage
  kind: BuildingPromiseKind
  /** What they promise, when the kind's own words do not say it: "the unconditional waiver on draw 2". */
  what?: string
  /** Ask the office what is coming: a delivery. */
  askWhat?: boolean
  /** Offer to write a day down: something is still owed. False: only a promise already made shows. */
  ask?: boolean
  /** A line under the promise, before the buttons: how the day sits against the plan. */
  note?: ReactNode
  dispatch: Dispatch<GcAction>
}) {
  const [open, setOpen] = useState(false)
  const [by, setBy] = useState('')
  const [thing, setThing] = useState('')
  const partnerId = pkg.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId
  if (!partnerId) return null
  const today = state.today
  const match = { partnerId, kind, projectId: project.id, packageId: pkg.id }
  const promise = openPromiseFor(state, match)
  const kept = promise
    ? undefined
    : tradePromisesOf(state)
        .filter((p) => p.keptOn && p.partnerId === partnerId && p.kind === kind && p.projectId === project.id && p.packageId === pkg.id)
        .filter((p) => (p.keptOn ?? '') >= addDays(today, -KEPT_SHOWN_DAYS))
        .pop()
  if (!promise && !kept && !ask) return null
  const save = () => {
    if (!by) return
    const typed = thing.trim()
    dispatch({
      type: 'recordPromise',
      ...match,
      by,
      from: 'office',
      ...(promise ? {} : { what: typed || what || PROMISE_WHAT[kind] }),
    })
    setOpen(false)
    setBy('')
    setThing('')
  }
  const s = promise ? tradePromiseState(promise, today).state : null
  const tone = s === 'passed' ? 'var(--text-red-700)' : s === 'today' ? 'var(--text-amber-800)' : 'var(--text-muted)'
  const small = { fontSize: '0.82rem' } as const
  return (
    <div style={{ display: 'grid', gap: '0.3rem', ...small }} data-promise={kind}>
      {promise && <div style={{ color: tone, fontWeight: s === 'passed' ? 600 : 400 }}>{tradePromiseWords(promise, today)}</div>}
      {!promise && kept && <div style={{ color: 'var(--text-muted)' }}>{tradePromiseWords(kept, today)}</div>}
      {promise && note}
      {open ? (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {askWhat && !promise && (
            <input
              value={thing}
              onChange={(e) => setThing(e.target.value)}
              placeholder="What is coming, like the rooftop units"
              aria-label="What is coming"
              style={{ ...box, flex: '1 1 12rem' }}
            />
          )}
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', color: 'var(--text-muted)' }}>
            {promise ? 'Their new day' : 'They said by'}
            <input type="date" min={today} value={by} onChange={(e) => setBy(e.target.value)} style={box} />
          </label>
          <Btn kind="primary" disabled={!by || by === promise?.by} onClick={save}>
            {promise ? 'Move it' : 'Write it down'}
          </Btn>
          <Btn kind="quiet" onClick={() => setOpen(false)}>
            Not now
          </Btn>
        </div>
      ) : (promise || ask) && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn kind="quiet" onClick={() => setOpen(true)}>
            {promise ? 'They gave a new day' : ASK[kind]}
          </Btn>
          {promise && kind === 'delivery' && (
            <Btn kind="quiet" onClick={() => dispatch({ type: 'keepPromise', id: promise.id })}>
              It came
            </Btn>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The papers a trade owes us, on Draws and on Closeout: an unconditional waiver for each paid draw,
 * and the final pay application once it can ask. With the day they gave. Nothing owed: only a day
 * kept this past week shows.
 */
export function GcBuildingPapersOwed({ state, project, pkg, dispatch }: { state: GcState; project: GcProject; pkg: TradePackage; dispatch: Dispatch<GcAction> }) {
  const words = papersOwedWords(papersOwed(project, pkg, state.today))
  if (!words) return <GcBuildingPromise state={state} project={project} pkg={pkg} kind="closeout" ask={false} dispatch={dispatch} />
  return (
    <div style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
      <span>
        <strong>Papers they owe:</strong> {words}.
      </span>
      <GcBuildingPromise state={state} project={project} pkg={pkg} kind="closeout" what={words} dispatch={dispatch} />
    </div>
  )
}
