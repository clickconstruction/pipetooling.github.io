/**
 * The sheet form speaks where a second sheet for the same work would start (punch list #346, PR 2):
 *
 *  - `SheetCrewWhoLine`, under the *Paid to* step's chips: whose the sheet is with the names picked. A second sub gets a
 *    warning and a press that takes them off, so their part can go on a sheet of their own. A teammate beside a sub
 *    gets the same warning and one press that takes the teammates off. It never blocks.
 *  - `SheetSameLineWarning`, over the lines: a line this job already carries on another sheet, words and amount alike.
 *
 * Words from `sheetCrewWords.ts`. Neither saves anything.
 */
import { useMemo } from 'react'
import { useRosterSubKinds } from '../../hooks/useRosterSubKinds'
import { buildSheetPartiesLookup } from '../../lib/subWorkOrders/sheetParties'
import { crewStepLine, jobTeamOfferWords, sameLinesOnOtherSheets, type CrewStepLine } from '../../lib/subWorkOrders/sheetCrewWords'
import type { LaborJob } from '../../types/laborJob'

export function SheetCrewWhoLine({ names, onTakeOff, onTakeOffAll }: { names: readonly string[]; onTakeOff?: (name: string) => void; onTakeOffAll?: (names: readonly string[]) => void }) {
  const { roster, loaded } = useRosterSubKinds()
  const lookup = useMemo(() => buildSheetPartiesLookup(roster), [roster])
  const line = loaded ? crewStepLine(names, lookup) : null
  return line ? <SheetCrewWhoLineView line={line} onTakeOff={onTakeOff} onTakeOffAll={onTakeOffAll} /> : null
}

const offerChip = { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: 999, border: '1px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' } as const

/** A picked job's team, offered and not ticked (the candidate that stops teammates landing on a sub's sheet). */
export function SheetJobTeamOffer({ team, picked, onPick }: { team: readonly string[]; picked: readonly string[]; onPick: (name: string) => void }) {
  const { words, offer } = jobTeamOfferWords(team, picked)
  if (!words) return null
  return (
    <div data-testid="sheet-job-team-offer" style={{ margin: '0.35rem 0 0.5rem', fontSize: '0.8125rem', textAlign: 'left', color: 'var(--text-muted)' }}>
      {words}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {offer.map((n) => (
          <button key={n} type="button" aria-label={`Put ${n} on this sheet`} onClick={() => onPick(n)} style={offerChip}>
            + {n}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The line itself, over built words. */
export function SheetCrewWhoLineView({ line, onTakeOff, onTakeOffAll }: { line: CrewStepLine; onTakeOff?: (name: string) => void; onTakeOffAll?: (names: readonly string[]) => void }) {
  const warn = line.tone === 'warn'
  return (
    <div
      data-testid="sheet-crew-who-line"
      role={warn ? 'alert' : undefined}
      style={{ margin: '0.35rem 0 0.5rem', padding: '0.5rem 0.7rem', borderRadius: 8, fontSize: '0.8125rem', textAlign: 'left', border: `1px solid ${warn ? 'var(--border-amber)' : 'var(--border)'}`, background: warn ? 'var(--bg-amber-tint)' : 'var(--bg-page)', color: warn ? 'var(--text-amber-900)' : 'var(--text-700)' }}
    >
      <b>{line.head}</b> {line.body}
      {warn && onTakeOff && line.extraSubs.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {line.extraSubs.map((n) => (
            <button key={n} type="button" onClick={() => onTakeOff(n)} style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 650, padding: '0.25rem 0.7rem', borderRadius: 6, border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer' }}>
              Take {n} off, for a sheet of their own
            </button>
          ))}
          <span style={{ alignSelf: 'center', fontSize: '0.75rem' }}>or keep both on this one.</span>
        </div>
      ) : null}
      {onTakeOffAll && line.rideAlongs.length > 0 ? (
        <div style={{ marginTop: 6 }}>
          <button type="button" onClick={() => onTakeOffAll(line.rideAlongs)} style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 650, padding: '0.25rem 0.7rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
            Take {line.rideAlongs.length === 1 ? line.rideAlongs[0] : `the ${line.rideAlongs.length} teammates`} off this sheet
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function SheetSameLineWarning({ draft, others }: { draft: ReadonlyArray<{ label: string; amount: number }>; others: ReadonlyArray<Pick<LaborJob, 'id' | 'items' | 'labor_rate'>> }) {
  const warnings = sameLinesOnOtherSheets(draft, others)
  if (warnings.length === 0) return null
  return (
    <div data-testid="sheet-same-line-warning" role="alert" style={{ margin: '0 0 0.6rem', padding: '0.5rem 0.7rem', borderRadius: 8, fontSize: '0.8125rem', border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-900)' }}>
      {warnings.map((w) => (
        <div key={`${w.label}-${w.amount}`}>{w.words}</div>
      ))}
    </div>
  )
}
