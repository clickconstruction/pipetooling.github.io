import { useState, type Dispatch, type ReactNode } from 'react'
import {
  insuranceRenewals,
  insuranceRenewalWords,
  paperAsks,
  partnerById,
  tradePromisesOf,
  tradePromiseState,
  tradePromiseWords,
  type GcAction,
  type GcState,
  type Partner,
  type PromiseKind,
  type TradePromise,
} from '../../lib/gcMode/gcModel'
import { Btn, Card, Chip, input } from './gcUi'

/**
 * GC mode design spike: Follow up's promises other than a quote date (the owner, 2026-10-04,
 * question 8). Insurance renewals first, then the papers we wait on, then every other open promise
 * of any lane's kind. Write down the day they give; the row turns red when it passes.
 */
export function GcFollowUpPromises({ state, dispatch }: { state: GcState; dispatch: Dispatch<GcAction> }) {
  const renewals = insuranceRenewals(state)
  const papers = paperAsks(state)
  const shown = new Set([...renewals.map((r) => r.promise?.id), ...papers.map((p) => p.promise?.id)])
  const others = tradePromisesOf(state).filter((p) => !p.keptOn && !shown.has(p.id) && p.kind !== 'insurance')
  if (renewals.length === 0 && papers.length === 0 && others.length === 0) return null
  return (
    <section data-tour="gc-follow-promises">
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Insurance, papers and other promises ({renewals.length + papers.length + others.length})</h3>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          When they give a day, write it down. It counts in their word record like a quote day.
        </span>
      </div>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {renewals.map((r) => (
          <PromiseRow
            key={`coi-${r.partner.id}`}
            state={state}
            partner={r.partner}
            tag="Insurance"
            words={insuranceRenewalWords(r)}
            urgent={r.days <= 7}
            promise={r.promise}
            kind="insurance"
            dispatch={dispatch}
            keptBy="It is kept when they send the new certificate from their portal."
          />
        ))}
        {papers.map((p) => (
          <PromiseRow
            key={`${p.kind}-${p.partner.id}-${p.packageId ?? ''}`}
            state={state}
            partner={p.partner}
            tag={p.kind === 'w9' ? 'W-9' : 'Statement of work'}
            words={p.words}
            urgent={false}
            promise={p.promise}
            kind={p.kind}
            projectId={p.projectId}
            packageId={p.packageId}
            dispatch={dispatch}
            keptBy={p.kind === 'w9' ? 'It is kept when they sign the W-9 in their portal.' : 'It is kept when they sign it in their portal.'}
          />
        ))}
        {others.map((p) => {
          const partner = partnerById(state, p.partnerId)
          const project = state.projects.find((x) => x.id === p.projectId)
          const trade = project?.packages.find((k) => k.id === p.packageId)?.trade
          return partner ? (
            <PromiseRow
              key={p.id}
              state={state}
              partner={partner}
              tag={project ? `${project.name}${trade ? ` · ${trade}` : ''}` : 'Their company'}
              words={null}
              urgent={false}
              promise={p}
              kind={p.kind}
              projectId={p.projectId}
              packageId={p.packageId}
              dispatch={dispatch}
              keptBy={null}
            />
          ) : null
        })}
      </div>
    </section>
  )
}

function PromiseRow({
  state,
  partner,
  tag,
  words,
  urgent,
  promise,
  kind,
  projectId,
  packageId,
  dispatch,
  keptBy,
}: {
  state: GcState
  partner: Partner
  tag: string
  /** What we are waiting on, when the promise alone does not say it. */
  words: string | null
  urgent: boolean
  promise: TradePromise | undefined
  kind: PromiseKind
  projectId?: string
  packageId?: string
  dispatch: Dispatch<GcAction>
  /** How it is kept on its own. Null: the office marks it with It came. */
  keptBy: string | null
}) {
  const [by, setBy] = useState('')
  const s = promise ? tradePromiseState(promise, state.today).state : null
  const red = urgent || s === 'passed'
  const amber = s === 'today'
  const save = () => {
    if (!by) return
    dispatch({ type: 'recordPromise', partnerId: partner.id, kind, projectId, packageId, by, from: 'office' })
    setBy('')
  }
  let line: ReactNode = null
  if (promise) line = <div style={{ fontSize: '0.9rem', color: red ? 'var(--text-red-700)' : undefined }}>{tradePromiseWords(promise, state.today)}</div>
  return (
    <Card style={{ borderLeft: `4px solid ${red ? 'var(--border-red)' : amber ? 'var(--border-amber)' : 'var(--border-blue)'}` }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong>{partner.company}</strong>
        <span style={{ color: 'var(--text-muted)' }}>{partner.contact}</span>
        <Chip tone="grey">{tag}</Chip>
      </div>
      {words && <div style={{ margin: '0.3rem 0 0.2rem', fontSize: '0.9rem' }}>{words}</div>}
      {line}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.4rem' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {promise ? 'They gave a new day' : 'They said by'}{' '}
          <input type="date" style={input} min={state.today} value={by} onChange={(e) => setBy(e.target.value)} />
        </label>
        <Btn disabled={!by} onClick={save}>
          {promise ? 'Move it' : 'Write it down'}
        </Btn>
        {promise && !keptBy && (
          <Btn kind="quiet" onClick={() => dispatch({ type: 'keepPromise', id: promise.id })}>
            It came
          </Btn>
        )}
        {keptBy && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{keptBy}</span>}
      </div>
    </Card>
  )
}
