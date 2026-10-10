import { useEffect, useState, type KeyboardEvent } from 'react'
import { carriedAmount, carriedUncosted, proposalTotals, proposalUncosted, proposalUncostedWords, uncostedWords } from '../../lib/gc/bids'
import { ownBidPriced, partnerById } from '../../lib/gc/lookups'
import { proposalWeeksWords, roughWeeks, roughWeeksWords } from '../../lib/gc/schedule/rough'
import type { GcProject, GcState, TradePackage } from '../../lib/gc/types'
import { money } from '../../lib/gc/words'
import type { PipelineJobHit } from '../../lib/gc/gcIo'
import { GcGeneralConditionsJob } from './GcGeneralConditionsJob'
import { Btn, Card, Chip, PlusUnknown, Stat, Why, input, num, td, th } from './gcUi'

/**
 * GC mode, the real build (the Board's B5-c): Our number on a project, from the design spike's
 * `GcNumberTab` (`GcOfficeTabs.tsx`). The trades we carry, plus general conditions, contingency and fee,
 * make the price we give the customer (`proposalTotals`). The three inputs live in `gc_project_money`,
 * which only the money team reads, so the page draws this for them alone. The outcome buttons sit on the
 * project's head instead (call D), where the rest of the office will see them without the money. Weeks to build (G-45,
 * the schedule's PR 12b) comes from the job's rough, which the page lays on the project when Our number opens: the
 * stat, the rough's sentence and the line for the proposal with Copy, after the price card's own rows. *Signed for* waits
 * for Owner Billing's O3.
 */

export interface OurNumberValues {
  generalConditions: number
  contingencyPct: number
  feePct: number
}

type Key = keyof OurNumberValues

/** A box that saves on blur or Enter once it holds a number in range, never on each key. */
function MoneyBox({ label, unit, value, max, onSave }: { label: string; unit: string; value: number; max?: number; onSave: (n: number) => Promise<void> }) {
  const [text, setText] = useState(String(value))
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => setText(String(value)), [value])
  const save = () => {
    const n = text.trim() === '' ? 0 : Number(text)
    if (!Number.isFinite(n) || n < 0 || (max !== undefined && n > max)) {
      setProblem(max !== undefined ? `Type a number from 0 to ${max}.` : 'Type a number, 0 or more.')
      return
    }
    setProblem(null)
    if (n === value) return
    onSave(n).catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'That did not save.'))
  }
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') save()
  }
  return (
    <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
      {label}
      <span>
        <input type="number" min={0} {...(max !== undefined ? { max } : {})} value={text} onChange={(e) => setText(e.target.value)} onBlur={save} onKeyDown={keys} aria-label={label} style={{ ...input, width: '8rem' }} />{' '}
        {unit}
      </span>
      {problem && <span style={{ color: 'var(--text-red-700)' }}>{problem}</span>}
    </label>
  )
}

/** Where a trade's number comes from: the quote we carry, our budget, our own bid, or nothing. */
function CarriedWords({ state, pkg }: { state: GcState; pkg: TradePackage }) {
  const amount = carriedAmount(pkg)
  if (pkg.selfPerform && !ownBidPriced(pkg)) {
    const guess = pkg.selfPerform.value
    return (
      <Chip tone="red" {...(guess > 0 ? { title: `Our guess so far is ${money(guess)}. It is not in our price until our own bid is priced.` } : {})}>
        ours · not priced yet
      </Chip>
    )
  }
  if (pkg.selfPerform) return <span>our own bid {pkg.selfPerform.ref}</span>
  if (amount === null) return <Chip tone="red">Nothing. A hole in our number.</Chip>
  if (pkg.carried === 'plug') return <Chip tone="amber">our budget, no quote</Chip>
  const invite = pkg.invites.find((i) => i.id === (pkg.awardedInviteId ?? pkg.carried))
  const partner = invite ? partnerById(state, invite.partnerId) : undefined
  return (
    <span>
      {partner?.company ?? 'their quote'} {pkg.awardedInviteId && <Chip tone="green">awarded</Chip>}
    </span>
  )
}

/** General conditions' Pipeline job on Our number (O11b): its number once read, the jobs a crew holds, the press and the search. */
export interface GcGeneralConditionsJobProps {
  jobLabel: string | null
  heldBy: Record<string, string>
  onName: (jobId: string | null) => Promise<void>
  search: (text: string) => Promise<PipelineJobHit[]>
}

export function GcOurNumber({ state, project, onSave, gcJob }: { state: GcState; project: GcProject; onSave: (values: OurNumberValues) => Promise<void>; gcJob?: GcGeneralConditionsJobProps }) {
  const totals = proposalTotals(project)
  const uncosted = proposalUncostedWords(project)
  const values: OurNumberValues = { generalConditions: project.generalConditions, contingencyPct: project.contingencyPct, feePct: project.feePct }
  const save = (key: Key) => (n: number) => onSave({ ...values, [key]: n })
  // Weeks to build, from the rough schedule while we bid (G-45): one count, kept as it went with the bid.
  const weeks = roughWeeks(project)
  const proposal = proposalWeeksWords(project)
  const [copied, setCopied] = useState(false)
  return (
    <div data-gc-our-number={project.id} style={{ display: 'grid', gap: '0.75rem' }}>
      <Card>
        <Why>
          The trades we carry, plus our own costs and fee, make the price we give {project.owner || 'the customer'}. A trade with no number is a hole. A trade on our own
          budget is a risk we are taking.
        </Why>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Stat
            label="Trades"
            value={
              <>
                {money(totals.trades)}
                <PlusUnknown words={uncosted} />
              </>
            }
          />
          <Stat label="General conditions" value={money(totals.generalConditions)} />
          <Stat label={`Contingency ${project.contingencyPct}%`} value={money(totals.contingency)} />
          <Stat label={`Fee ${project.feePct}%`} value={money(totals.fee)} />
          <Stat
            label={`Price to ${project.owner || 'the customer'}`}
            value={
              <>
                {money(totals.price)}
                <PlusUnknown words={uncosted} />
              </>
            }
            {...(totals.holes.length > 0 ? { tone: 'red' as const } : proposalUncosted(project).length > 0 ? {} : { tone: 'green' as const })}
          />
        </div>
        {(totals.holes.length > 0 || totals.plugged.length > 0) && (
          <div style={{ marginTop: '0.7rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {totals.holes.map((p) => (
              <Chip key={p.id} tone="red">
                {p.trade}: no number
              </Chip>
            ))}
            {totals.plugged.map((p) => (
              <Chip key={p.id} tone="amber">
                {p.trade}: our budget, no quote
              </Chip>
            ))}
          </div>
        )}
        <div style={{ marginTop: '0.9rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <MoneyBox label="General conditions" unit="dollars" value={project.generalConditions} onSave={save('generalConditions')} />
          <MoneyBox label="Contingency" unit="%" max={100} value={project.contingencyPct} onSave={save('contingencyPct')} />
          <MoneyBox label="Fee" unit="%" max={100} value={project.feePct} onSave={save('feePct')} />
        </div>
        {gcJob && (
          <div style={{ marginTop: '0.75rem' }}>
            <GcGeneralConditionsJob jobId={project.generalConditionsJobId ?? null} {...gcJob} />
          </div>
        )}
        {(weeks || project.stage === 'pursuing') && (
          <div data-tour="gc-bid-weeks" style={{ marginTop: '0.9rem', display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
            <Stat label="Weeks to build" value={weeks ? String(weeks.weeks) : 'not drawn'} />
            {weeks && proposal ? (
              <>
                <span>{roughWeeksWords(project)}</span>
                <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>For the proposal:</span>
                  <span>{proposal}</span>
                  <Btn
                    kind="quiet"
                    onClick={() => {
                      void navigator.clipboard?.writeText(proposal)
                      setCopied(true)
                    }}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Btn>
                </span>
              </>
            ) : !project.lostOn ? (
              <span style={{ color: 'var(--text-muted)' }}>Weeks to build: not drawn yet. Draw a rough schedule from the project&apos;s Schedule.</span>
            ) : null}
          </div>
        )}
      </Card>
      <Card style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Trade</th>
              <th style={th}>Where the number comes from</th>
              <th style={{ ...th, textAlign: 'right' }}>Our budget</th>
              <th style={{ ...th, textAlign: 'right' }}>Carried</th>
            </tr>
          </thead>
          <tbody>
            {project.packages.map((pkg) => {
              const amount = carriedAmount(pkg)
              return (
                <tr key={pkg.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{pkg.trade}</td>
                  <td style={td}>
                    <CarriedWords state={state} pkg={pkg} />
                  </td>
                  <td style={num}>{money(pkg.budget)}</td>
                  <td style={{ ...num, fontWeight: 600 }}>
                    {amount === null ? '—' : money(amount)}
                    {amount !== null && <PlusUnknown words={uncostedWords(carriedUncosted(pkg))} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
