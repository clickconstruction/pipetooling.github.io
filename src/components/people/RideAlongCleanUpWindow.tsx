/**
 * Take the teammates off the subs' sheets (punch list #346; Taunya's yes of 2026-11-15).
 *
 * The sheets where a teammate is named beside a sub, each with who keeps it and who comes off, shown before anything
 * is saved. Every ready sheet starts ticked. A sheet that needs a look first is held with its reason and its door and
 * never stops the rest. The press names its count, goes on past a sheet the database refuses, and lists that sheet
 * afterwards with the reason.
 *
 * The plan and every word come from `rideAlongCleanUp.ts`. The save is one write per sheet: the sheet's names become
 * the sub's name, and the database rebuilds the sheet's people from it.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { ledgerDayWords } from '../../lib/subWorkOrders/subPaymentsLedger'
import { rideAlongOutcomeWords, rideAlongPlan, rideAlongRowWords, type RideAlongCleanUp, type RideAlongFailure, type RideAlongRow } from '../../lib/subWorkOrders/rideAlongCleanUp'
import { formatErrorMessage } from '../../utils/errorHandling'
import { MoneyText } from '../Money'

const usd = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const shell: CSSProperties = { position: 'fixed', inset: 0, zIndex: 1002, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }
const box: CSSProperties = { background: 'var(--surface)', color: 'var(--text-700)', borderRadius: 10, padding: '1.1rem 1.2rem', maxHeight: 'min(90vh, 100%)', overflowY: 'auto', boxSizing: 'border-box', width: 'min(640px, 100%)' }
const quiet: CSSProperties = { font: 'inherit', fontSize: '0.875rem', padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const press = (live: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.875rem', fontWeight: 650, padding: '0.4rem 0.9rem', borderRadius: 6, border: 'none', background: live ? '#2563eb' : DEAD_PRESS_FILL, color: live ? 'white' : DEAD_PRESS_TEXT, cursor: live ? 'pointer' : 'default' })
const door: CSSProperties = { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer' }

export type RideAlongOutcome = { done: number; failed: RideAlongFailure[] }

export type RideAlongCleanUpWindowViewProps = {
  cleanUp: RideAlongCleanUp
  busy: boolean
  outcome: RideAlongOutcome | null
  onRun: (rows: RideAlongRow[]) => void
  /** Opens one sheet where it can be changed: the door of a held sheet. */
  onOpenSheet: (sheetId: string) => void
  onClose: () => void
}

export function RideAlongCleanUpWindowView({ cleanUp, busy, outcome, onRun, onOpenSheet, onClose }: RideAlongCleanUpWindowViewProps) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(cleanUp.ready.map((r) => r.sheetId)))
  const plan = useMemo(() => rideAlongPlan(cleanUp, picked), [cleanUp, picked])
  const result = outcome ? rideAlongOutcomeWords(outcome.done, outcome.failed.length) : null
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const live = !plan.words.dead && !busy
  return (
    <div role="presentation" onClick={onClose} style={shell}>
      <div role="dialog" aria-modal="true" aria-label="Take the teammates off the subs' sheets" onClick={(e) => e.stopPropagation()} style={box}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>Teammates named on a sub’s sheet</h3>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
          These names came from the job’s team when the sheet was made. A sheet pays one person, and each of these is already the sub’s, whole. Taking the teammates off changes who is named. It moves no money, and it moves each sheet’s cost onto its sub in reviews.
        </div>
        {cleanUp.ready.length === 0 && cleanUp.held.length === 0 ? <p style={{ margin: '0.8rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Nothing waiting on this. No sub’s sheet names a teammate.</p> : null}

        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {cleanUp.ready.map((r) => {
            const on = picked.has(r.sheetId)
            return (
              <label key={r.sheetId} data-testid="ride-along-row" style={{ display: 'block', border: `1px solid ${on ? '#2563eb' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', borderRadius: 8, padding: '0.5rem 0.7rem', cursor: 'pointer' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.25rem 0.6rem', fontSize: '0.875rem' }}>
                  <input type="checkbox" checked={on} disabled={busy} onChange={() => toggle(r.sheetId)} aria-label={`${r.label}, ${r.sub.name}`} />
                  <b>{r.label}</b>
                  {r.day ? <span style={{ color: 'var(--text-muted)' }}>{ledgerDayWords(r.day, true)}</span> : null}
                  <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    <MoneyText text={usd(r.total)} /> · {r.open > 0 ? <b><MoneyText text={usd(r.open)} /> open</b> : 'paid'}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3, paddingLeft: 22 }}>{rideAlongRowWords(r)}</div>
              </label>
            )
          })}
        </div>

        {cleanUp.held.length > 0 ? (
          <div data-testid="ride-along-held" style={{ marginTop: 12 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {cleanUp.held.length} {cleanUp.held.length === 1 ? 'needs' : 'need'} a look first
            </div>
            {cleanUp.held.map((h) => (
              <div key={h.sheetId} style={{ borderTop: '1px solid var(--border)', padding: '0.4rem 0', fontSize: '0.8125rem' }}>
                <b>{h.label}</b> <span style={{ color: 'var(--text-muted)' }}>{h.names}</span>
                <div style={{ color: 'var(--text-red-700)' }}>{h.why}</div>
                <button type="button" style={door} onClick={() => onOpenSheet(h.sheetId)}>
                  {h.door === 'whose' ? 'Open the sheet to say whose it is ›' : 'Open the sheet ›'}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {plan.effect ? (
          <div data-testid="ride-along-effect" style={{ marginTop: 12, padding: '0.5rem 0.7rem', borderRadius: 8, background: 'var(--bg-page)', border: '1px solid var(--border)', fontSize: '0.8125rem' }}>
            <div>{plan.effect}</div>
            <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{plan.sumWords}</div>
            <div data-testid="ride-along-review" style={{ color: 'var(--text-muted)', marginTop: 2 }}>{plan.reviewWords}</div>
          </div>
        ) : null}

        {outcome && result ? (
          <div role="status" data-testid="ride-along-outcome" style={{ marginTop: 10, fontSize: '0.8125rem' }}>
            <div style={{ color: result.tone === 'success' ? 'var(--text-green-700)' : 'var(--text-strong)' }}>{result.line}</div>
            {result.head ? <div style={{ fontWeight: 650, marginTop: 4 }}>{result.head}</div> : null}
            {outcome.failed.map((f) => (
              <div key={f.row.sheetId} style={{ color: 'var(--text-red-700)' }}>
                {f.row.label}, {f.row.sub.name}. {f.reason}{' '}
                <button type="button" style={door} onClick={() => onOpenSheet(f.row.sheetId)}>
                  Open the sheet ›
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          {plan.words.foot ? <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 'auto', flex: '1 1 220px' }}>{plan.words.foot}</span> : null}
          <button type="button" style={quiet} onClick={onClose}>
            Close
          </button>
          <button type="button" disabled={!live} style={press(live)} onClick={() => onRun(plan.rows)}>
            {busy ? 'Taking them off…' : plan.words.button}
          </button>
        </div>
      </div>
    </div>
  )
}

/** The connected window: one write per sheet, each on its own, so a refusal stops only its sheet. */
export function RideAlongCleanUpWindow({ cleanUp, onDone, onOpenSheet, onClose }: { cleanUp: RideAlongCleanUp; onDone: () => void; onOpenSheet: (sheetId: string) => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<RideAlongOutcome | null>(null)
  const run = async (rows: RideAlongRow[]) => {
    setBusy(true)
    const result: RideAlongOutcome = { done: 0, failed: [] }
    for (const row of rows) {
      // The names become the sub's name. The database's trigger rebuilds the sheet's people from it.
      const upd = await supabase.from('people_labor_jobs').update({ assigned_to_name: row.nextAssignedToName }).eq('id', row.sheetId)
      if (upd.error) {
        result.failed.push({ row, reason: `Nothing was changed: ${formatErrorMessage(upd.error, 'the database gave no reason')}` })
        continue
      }
      // Belt and braces, as the sheet form does: the sub stays tied by id even if the name does not resolve.
      const link = await supabase.from('people_labor_job_assignees').upsert([{ labor_job_id: row.sheetId, person_id: row.sub.id }], { onConflict: 'labor_job_id,person_id', ignoreDuplicates: true })
      if (link.error) result.failed.push({ row, reason: `The teammates came off, and the tie to ${row.sub.name}'s roster row did not save: ${formatErrorMessage(link.error, 'the database gave no reason')}` })
      else result.done += 1
    }
    setBusy(false)
    setOutcome(result)
    if (result.done > 0 || result.failed.length > 0) onDone()
  }
  return <RideAlongCleanUpWindowView cleanUp={cleanUp} busy={busy} outcome={outcome} onRun={(rows) => void run(rows)} onOpenSheet={onOpenSheet} onClose={onClose} />
}
