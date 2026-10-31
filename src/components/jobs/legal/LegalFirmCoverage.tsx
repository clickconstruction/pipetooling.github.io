import { useMemo, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { useHoldsUnsavedWork } from '../../../hooks/useHoldsUnsavedWork'
import LegalFirmCountyMap from '../../settings/LegalFirmCountyMap'
import LegalCountyHeldSheet from '../../settings/LegalCountyHeldSheet'
import { alsoCovers, answerHeld, changedWords, countyChanges, countyWords, firmHues, firmLegend, firmsOfCover, firstCalls, heldDoneWords, makeFirstCall, pressCounty, pressWords, savedWords, type CountyCover, type Coverage, type HeldAnswer } from '../../../lib/legal/firmCounties'
import { effectiveStand, uncoveredCounties, uncoveredWords, type LegalMapCase } from '../../../lib/legal/firmMap'
import { bridgeEndsWords, coverageCasesChip, coverageCountyChip, coverageHintWords, coverageNudgeButton, coverageNudgeWords, coverageState, coverageSumWords, firmWindowCoverage, type FirmWindowCoverage } from '../../../lib/legal/firmWindowCoverage'
import { AREA_PRESETS, applyArea, areaChipWords, areaWords, extendChangeWords, gapChipWords } from '../../../lib/legal/firmAreaPresets'
import { saveCountyChanges } from '../../../lib/legal/firmCountiesSave'
import { countedLabel } from '../../../lib/batchWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../../lib/deadPress'
import { formatLegalMoney } from '../../../lib/legal/legalPacket'
import type { LegalFirmRow } from '../../../lib/legal/legalMatters'

const db = supabase as unknown as SupabaseClient

/**
 * Where the firm covers, in the firm's window (punch list #222). PR 1 (v2.6195): the county map in lens mode with
 * this firm lit, one row per county with the cases and open dollars that count for the firm (`firmWindowCoverage`,
 * the Map view's legend rule), the sum row, *Show on the desk map ›*, and in place of the map the nudge while no
 * county is colored for any firm, or the line that the firm covers none while others do. Everyone on the desk reads it.
 *
 * PR 2 (v2.6221): a dev's **Extend coverage…** (or the nudge's *Color <firm>'s counties…*) turns the same map into
 * the picker for this firm alone: a free county colors, the firm's own clears, another firm's asks before it moves.
 * *Add by area* colors a metro in one press, and the gap chip colors every county with a case and no firm. The list
 * follows the draft, so the cases and dollars a county brings show before the save. Under it, what the save will
 * change in sentences, and **Save N counties** through `saveCountyChanges`, the Settings picker's own write.
 *
 * PR 3 (v2.6227): a county may have several firms and one first call. A county the firm covers without being first
 * call reads *also* with the first call named, and while editing it offers *Make first call*. A county only other
 * firms cover asks three ways (`LegalCountyHeldSheet`): share it, take first call, or move it.
 */
export default function LegalFirmCoverage({ firm, firms, coverage: saved, cases, canEdit, onShowOnMap, onSaved }: {
  firm: LegalFirmRow
  firms: ReadonlyArray<LegalFirmRow>
  /** The saved coverage: county → first call and the firms that also cover it. */
  coverage: Coverage
  cases: ReadonlyArray<LegalMapCase>
  canEdit: boolean
  onShowOnMap?: (firmId: string) => void
  /** After a save: the desk reloads its firms and counties. */
  onSaved: () => void
}) {
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const [county, setCounty] = useState<string | null>(null)
  const [extending, setExtending] = useState(false)
  const [draft, setDraft] = useState<Map<string, CountyCover>>(() => new Map(saved))
  const [held, setHeld] = useState<{ county: string; holderId: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const changes = useMemo(() => (extending ? countyChanges(saved, draft) : []), [extending, saved, draft])
  useHoldsUnsavedWork(changes.length > 0 || saving, 'Law firm counties')

  const shown = extending ? draft : saved
  const assignments = useMemo(() => firstCalls(shown), [shown])
  const also = useMemo(() => alsoCovers(shown), [shown])
  const hues = useMemo(() => firmHues(firms), [firms])
  const legend = useMemo(() => firmLegend(firms, assignments), [firms, assignments])
  const firmNames = useMemo(() => new Map(firms.map((f) => [f.id, f.name] as const)), [firms])
  const nameOf = (id: string) => firmNames.get(id) ?? 'another firm'
  const coverage = useMemo(() => firmWindowCoverage(firm.id, shown, cases), [firm.id, shown, cases])
  const state = coverageState(firm.id, saved, firms.filter((f) => f.active).length)
  const nudge = coverageNudgeWords(firm.name, state)
  const savedFirst = useMemo(() => firstCalls(saved), [saved])
  const flag = !extending && state.kind === 'covers' ? uncoveredWords(cases, savedFirst) : null
  const gaps = useMemo(() => (extending ? uncoveredCounties(cases, assignments) : []), [extending, cases, assignments])
  const canExtend = canEdit

  const startExtending = () => {
    setDraft(new Map(saved))
    setCounty(null)
    setExtending(true)
  }
  const stopExtending = async () => {
    if (changes.length > 0) {
      const n = changes.length
      const yes = await confirm({ title: 'Unsaved counties', message: `Drop ${n} ${n === 1 ? 'county change' : 'county changes'}? The map goes back to what is saved.`, confirmLabel: 'Drop the changes', cancelLabel: 'Keep editing', cancelIsSafe: true })
      if (!yes) return
    }
    setExtending(false)
    setDraft(new Map(saved))
  }
  const pressOnMap = async (c: string) => {
    setCounty(c)
    if (!extending) return
    const { next, press } = pressCounty(draft, c, firm.id)
    if (press.kind !== 'held') {
      setDraft(next)
      showToast(pressWords(press, c, firm.name), 'success')
      return
    }
    // A county only other firms cover: share it, take first call, or move it (v2.6227).
    setHeld({ county: c, holderId: press.byFirmId })
  }
  const answer = (a: HeldAnswer) => {
    if (!held) return
    setDraft(answerHeld(draft, held.county, firm.id, a))
    showToast(heldDoneWords(a, held.county, firm.name, nameOf(held.holderId)), 'success')
    setHeld(null)
  }
  const takeFirstCall = (c: string) => {
    const cover = draft.get(c)
    if (!cover) return
    setDraft(makeFirstCall(draft, c, firm.id))
    showToast(heldDoneWords('first_call', c, firm.name, nameOf(cover.first)), 'success')
  }
  const pressArea = (label: string, counties: ReadonlyArray<string>) => {
    const applied = applyArea(draft, counties, firm.id)
    setDraft(applied.next)
    showToast(areaWords(label, applied, firm.name, nameOf), applied.colored.length ? 'success' : 'info')
  }
  const save = async () => {
    if (changes.length === 0 || saving) return
    setSaving(true)
    try {
      const n = changes.length
      const r = await saveCountyChanges(db, changes)
      if (!r.ok) {
        showToast(r.message, 'error')
        // Another tab changed a county: the desk reads what stands now and the picker closes on it. Any other
        // refusal keeps the picker and its draft open, so nothing picked is lost.
        if (r.conflict) {
          onSaved()
          setExtending(false)
        }
        return
      }
      showToast(savedWords(n), 'success')
      setExtending(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const saveLabel = saving ? 'Saving…' : countedLabel('Save', changes.length, ['county', 'counties'])
  const saveDead = changes.length === 0 || saving
  const changeLines = extending ? extendChangeWords(changes, firm.id, nameOf) : []
  // The cliff (v2.6221): while nothing is colored for any firm, the first save ends the default; name the cases it strands.
  // Only an account still in review can be released, so a given-up account or one already with a firm is not stranded.
  const bridgeEnds = extending && changes.length > 0 && state.kind === 'nothing_colored'
    ? bridgeEndsWords(firm.name, cases.filter((c) => c.stand === 'eyes' && effectiveStand(c, assignments) === 'none'))
    : null

  return (
    <section data-legal-firm-coverage={extending ? 'extending' : state.kind} style={{ marginTop: 2 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Where {firm.name} covers</h4>
        <span data-legal-firm-coverage-counties style={chip}>{coverageCountyChip(coverage.counties)}</span>
        <span data-legal-firm-coverage-cases style={chip}>{coverageCasesChip(coverage.cases, coverage.balance)}</span>
        {extending ? <span data-legal-firm-extending style={{ ...chip, borderColor: 'var(--border-blue)', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }}>editing</span> : null}
      </div>
      {extending ? (
        <p data-legal-firm-extend-help style={{ margin: '4px 0 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Pressing a county adds it for {firm.name} or takes it off. Nothing is saved until you press Save.
        </p>
      ) : nudge ? (
        <div data-legal-firm-nudge={state.kind} style={{ marginTop: 8, background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber-soft)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '10px 12px', fontSize: '0.84rem' }}>
          {nudge}
          {canExtend ? (
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={startExtending} style={btnPrimary} data-legal-firm-color-counties>{coverageNudgeButton(firm.name)}</button>
            </div>
          ) : null}
        </div>
      ) : (
        <p style={{ margin: '2px 0 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{coverageHintWords(firm.name)}</p>
      )}
      {extending ? (
        <div data-legal-firm-areas style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 8px', fontSize: '0.8rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Add by area:</span>
          {AREA_PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => pressArea(p.label, p.counties)} style={chipBtn} data-legal-firm-area={p.key} title={`Add ${p.counties.join(', ')} for ${firm.name}`}>{areaChipWords(p)}</button>
          ))}
          {gapChipWords(gaps) ? (
            <button type="button" onClick={() => pressArea('Counties with a case and no firm', gaps)} style={{ ...chipBtn, borderColor: 'var(--border-red)', color: 'var(--text-red-700)' }} data-legal-firm-area="gaps" title={`Add ${gaps.join(', ')} for ${firm.name}`}>{gapChipWords(gaps)}</button>
          ) : null}
        </div>
      ) : null}
      {extending || state.kind === 'covers' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <LegalFirmCountyMap
              lens={!extending}
              litFirmId={firm.id}
              assignments={assignments}
              hues={hues}
              firmNames={firmNames}
              legend={legend}
              pickedFirmId={extending ? firm.id : null}
              also={also}
              cases={cases}
              heldCaseId={null}
              selectedCounty={county}
              onPress={(c) => void pressOnMap(c)}
              onHoverCounty={() => {}}
              onPressCase={(c) => setCounty(c.county)}
              idleWords={extending ? `Press a county to add it for ${firm.name}, or to take it off.` : `${firm.name}’s counties in color, the other firms’ faint. Tap a county to hold it in the list.`}
            />
            {flag ? <div data-legal-firm-coverage-flag style={{ background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', borderRadius: 6, padding: '6px 10px', fontSize: '0.78rem', marginTop: 8 }}>{flag}</div> : null}
          </div>
          <div style={{ minWidth: 0 }}>
            <CoverageTable
              coverage={coverage}
              county={county}
              added={new Set(changes.filter((c) => !firmsOfCover(c.from).includes(firm.id) && firmsOfCover(c.to).includes(firm.id)).map((c) => c.county))}
              nameOf={nameOf}
              onHold={setCounty}
              onTakeFirstCall={extending ? takeFirstCall : undefined}
            />
            {extending ? (
              <div data-legal-firm-extend-foot style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                {changeLines.length ? (
                  <div data-legal-firm-extend-changes style={{ fontSize: '0.8rem', color: 'var(--text)' }}>
                    {changeLines.map((l) => <div key={l}>{l}</div>)}
                  </div>
                ) : null}
                {bridgeEnds ? (
                  <div data-legal-firm-bridge-ends style={{ background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber-soft)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '8px 10px', fontSize: '0.8rem' }}>{bridgeEnds}</div>
                ) : null}
                <span data-legal-firm-extend-pending style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{changedWords(changes.length)} New releases follow the saved map. A matter stays with the firm it went to.</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => void save()} disabled={saveDead} title={changes.length === 0 ? 'Press a county or an area first' : undefined} style={saveDead ? { ...btn, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: DEAD_PRESS_FILL, cursor: 'default' } : btnPrimary} data-legal-firm-extend-save>{saveLabel}</button>
                  <button type="button" onClick={() => void stopExtending()} disabled={saving} style={btn} data-legal-firm-extend-cancel>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canExtend ? <button type="button" onClick={startExtending} style={btnPrimary} data-legal-firm-extend>Extend coverage…</button> : null}
                {onShowOnMap ? <button type="button" onClick={() => onShowOnMap(firm.id)} style={btn} data-legal-firm-show-on-map title="The desk’s Map view with this firm lit: its counties in color, the other firms’ faint">Show on the desk map ›</button> : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
      {held ? <LegalCountyHeldSheet county={held.county} holderName={nameOf(held.holderId)} firmName={firm.name} onAnswer={answer} onCancel={() => setHeld(null)} /> : null}
    </section>
  )
}

/**
 * The counties list: a row per county the firm covers (in the draft while editing), its cases and open dollars, and
 * the sum. A county the firm shares reads *also* with its first call named (v2.6227); while editing it offers *Make
 * first call*.
 */
function CoverageTable({ coverage, county, added, nameOf, onHold, onTakeFirstCall }: {
  coverage: FirmWindowCoverage
  county: string | null
  added: ReadonlySet<string>
  nameOf: (firmId: string) => string
  onHold: (c: string | null) => void
  onTakeFirstCall?: (c: string) => void
}) {
  return (
    <table data-legal-firm-coverage-rows style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.84rem' }}>
      <thead>
        <tr>
          <th style={th}>County</th>
          <th style={{ ...th, textAlign: 'right' }}>Cases</th>
          <th style={{ ...th, textAlign: 'right' }}>Open</th>
        </tr>
      </thead>
      <tbody>
        {coverage.rows.map((r) => {
          const held = county === r.county
          const isNew = added.has(r.county)
          return (
            <tr key={r.county} data-legal-firm-coverage-row={r.county} data-held={held ? '1' : undefined} data-new={isNew ? '1' : undefined} style={{ background: held ? 'var(--bg-subtle)' : undefined }}>
              <td style={{ ...td, fontWeight: 600 }}>
                <button type="button" onClick={() => onHold(held ? null : r.county)} aria-pressed={held} title={held ? 'Let go of the county' : `Hold ${countyWords(r.county)} on the map`} style={{ padding: 0, background: 'none', border: 'none', font: 'inherit', fontWeight: 600, color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}>
                  {countyWords(r.county)}
                </button>
                {isNew ? <span style={{ marginLeft: 6, fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-blue-800)', background: 'var(--bg-blue-tint)', borderRadius: 999, padding: '0 6px' }}>new</span> : null}
                {r.role === 'also' ? (
                  <span data-legal-firm-coverage-also style={{ display: 'block', fontWeight: 400, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    also covers · {nameOf(r.firstCall)} first call
                    {onTakeFirstCall ? <> · <button type="button" onClick={() => onTakeFirstCall(r.county)} data-legal-firm-take-first-call={r.county} style={{ padding: 0, background: 'none', border: 'none', color: 'var(--text-link)', font: 'inherit', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Make first call</button></> : null}
                  </span>
                ) : null}
              </td>
              <td style={num}>{r.cases}</td>
              <td style={{ ...num, color: r.cases ? undefined : 'var(--text-muted)' }}>{r.cases ? formatLegalMoney(r.balance) : '—'}</td>
            </tr>
          )
        })}
        <tr data-legal-firm-coverage-sum style={{ fontWeight: 600 }}>
          <td style={{ ...td, borderBottom: 0 }}>{coverageSumWords(coverage)}</td>
          <td style={{ ...num, borderBottom: 0 }}>{coverage.cases}</td>
          <td style={{ ...num, borderBottom: 0, color: coverage.cases ? undefined : 'var(--text-muted)' }}>{coverage.cases ? formatLegalMoney(coverage.balance) : '—'}</td>
        </tr>
      </tbody>
    </table>
  )
}

const th: CSSProperties = { textAlign: 'left', fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '3px 6px', borderBottom: '1px solid var(--border-strong)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '5px 6px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const num: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
// Longhands: Save flips between its dead and live styles, and React drops a border shorthand under a changing borderColor.
const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }
const chip: CSSProperties = { border: '1px solid var(--border)', borderRadius: 999, padding: '1px 9px', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.8rem' }
const chipBtn: CSSProperties = { ...chip, cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', fontWeight: 600 }
