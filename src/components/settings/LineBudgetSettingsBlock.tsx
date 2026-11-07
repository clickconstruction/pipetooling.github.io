import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useBidCrewRate } from '../../hooks/useBidCrewRate'
import { CREW_RATE_WINDOW_DAYS } from '../../lib/bids/crewRate'
import { useLineBudgetSettings } from '../../hooks/useLineBudgetSettings'
import { saveLineBudgetSettings } from '../../lib/jobs/lineBudgetSettingsStore'
import {
  applyLearningLine,
  applySettingsRate,
  applySettingsSplit,
  applySettingsTarget,
  learningLinesFor,
  lineBudgetSettingsChanges,
  lineBudgetSettingsSaveWords,
  LINE_SPLIT_KIND_WORDS,
  LINE_SPLIT_KINDS,
  settingsReadoutWords,
  type LearningLine,
  type LineBudgetSettings,
  type LineSplitKind,
  type TunedLineSource,
} from '../../lib/jobs/lineBudgets'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * Settings → Jobs & billing → Line budgets (punch list #234 PR 1b): the split a typed line gets
 * until the owner tunes it, two sliders per stage kind with the margin as what is left and the
 * target as a dashed mark, the burdened cost rate the hours use with the roster's rate beside it,
 * each row read out in dollars and hours on a line of the size the owner picks. A draft until
 * Save, which names what it writes; Back to what you saved is the undo. Save moves only lines still
 * assumed, since those store nothing — never a workbench line or one the owner tuned. The learning
 * line sits on its kind's row once a handful of tunes sit off the default, and moves it only on
 * the press.
 */
const LABOR = '#2563eb'
const MATERIALS = '#f59e0b'
const LINE_SIZES = [4_000, 10_000, 28_000, 52_000] as const

const usd0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.75rem', display: 'grid', gap: 8, background: 'var(--surface)' }
const rowGrid: CSSProperties = { display: 'grid', gridTemplateColumns: '78px minmax(0, 1fr) 56px', gap: 10, alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }
const pctBox: CSSProperties = { width: 34, border: 'none', borderBottom: '1px dashed var(--border-strong)', background: 'none', font: 'inherit', fontWeight: 700, fontSize: '0.82rem', textAlign: 'right', padding: '0 1px', color: 'inherit' }
const readBar: CSSProperties = { position: 'relative', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--border)', display: 'flex' }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem' }
const chip = (on: boolean): CSSProperties => ({ border: `1px solid ${on ? '#2563eb' : 'var(--border-strong)'}`, background: on ? '#2563eb' : 'var(--surface)', color: on ? '#fff' : 'inherit', borderRadius: 999, padding: '0.1rem 0.6rem', fontSize: '0.74rem', cursor: 'pointer', font: 'inherit' })
const btn = (primary: boolean, dead: boolean): CSSProperties => ({ padding: '0.4rem 0.9rem', fontSize: '0.82rem', fontWeight: 600, borderRadius: 6, cursor: dead ? 'default' : 'pointer', border: `1px solid ${primary && !dead ? '#2563eb' : 'var(--border-strong)'}`, background: primary && !dead ? '#2563eb' : 'var(--surface)', color: primary && !dead ? '#fff' : dead ? 'var(--text-muted)' : 'inherit' })

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function LineBudgetSettingsBlock() {
  const { role } = useAuth()
  const canSet = role === 'dev' || role === 'master_technician'
  const { showToast } = useToastContext()
  const { settings: saved, loaded, savedAt } = useLineBudgetSettings()
  const [draft, setDraft] = useState<LineBudgetSettings | null>(null)
  const [lineUsd, setLineUsd] = useState<number>(LINE_SIZES[1])
  const [saving, setSaving] = useState(false)
  const [tuned, setTuned] = useState<TunedLineSource[] | null>(null)
  const { crewRate } = useBidCrewRate(canSet)
  const rosterRate = crewRate?.companyRate ?? null
  const s = draft ?? saved
  const changes = useMemo(() => lineBudgetSettingsChanges(saved, s), [saved, s])

  // The learning line's material: every line the owner tuned, read once; a failed read means no line.
  useEffect(() => {
    if (!canSet) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase.from('jobs_ledger_fixtures').select('name, budget_labor_pct').eq('budget_source', 'tuned').limit(1000)
      if (!cancelled) setTuned(error ? [] : ((data ?? []) as TunedLineSource[]))
    })()
    return () => {
      cancelled = true
    }
  }, [canSet])
  const learning = useMemo(() => (tuned ? learningLinesFor(tuned, s) : []), [tuned, s])

  const move = (kind: LineSplitKind, field: 'labor' | 'materials', value: number) => {
    if (!canSet) return
    setDraft(applySettingsSplit(s, kind, field, value))
  }
  const save = async () => {
    if (!changes.any || saving) return
    setSaving(true)
    try {
      await saveLineBudgetSettings(s)
      setDraft(null)
      showToast(`${lineBudgetSettingsSaveWords(changes).replace('Save · ', 'Saved ')}. Every line still assumed reads the new numbers.`, 'success')
    } catch (e) {
      showToast(`Could not save the line budgets: ${formatErrorMessage(e)}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const sliderRow = (kind: LineSplitKind, field: 'labor' | 'materials', label: string, color: string, pct: number, max: number) => (
    <div style={rowGrid}>
      <span style={{ fontWeight: 600, color }}>{label}</span>
      <input type="range" min={0} max={max} step={1} value={pct} disabled={!canSet} aria-label={`${LINE_SPLIT_KIND_WORDS[kind]} ${label.toLowerCase()} percent`} onChange={(e) => move(kind, field, Number(e.target.value))} style={{ width: '100%', margin: 0, accentColor: color, height: 28, opacity: canSet ? 1 : 0.7 }} />
      <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 2, fontVariantNumeric: 'tabular-nums' }}>
        <input type="text" inputMode="numeric" value={pct} readOnly={!canSet} aria-label={`${LINE_SPLIT_KIND_WORDS[kind]} ${label.toLowerCase()} percent, typed`} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v !== '') move(kind, field, Number(v)) }} style={{ ...pctBox, color }} />
        <span>%</span>
      </span>
    </div>
  )

  const kindRow = (kind: LineSplitKind) => {
    const [l, m] = s.splits[kind]
    const margin = 100 - l - m
    const under = margin < s.targetMarginPct
    const line = learning.find((x) => x.kind === kind) ?? null
    return (
      <div key={kind} style={card} data-testid={`line-budget-kind-${kind}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <b style={{ fontSize: '0.9rem' }}>{LINE_SPLIT_KIND_WORDS[kind]}</b>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }} data-testid={`line-budget-readout-${kind}`}>{settingsReadoutWords(s, kind, lineUsd)}</span>
        </div>
        {sliderRow(kind, 'labor', 'Labor', LABOR, l, 100)}
        {sliderRow(kind, 'materials', 'Materials', MATERIALS, m, 100 - l)}
        <div style={{ display: 'grid', gap: 3 }}>
          <div style={readBar} aria-hidden>
            <i style={{ display: 'block', height: 10, width: `${l}%`, background: LABOR }} />
            <i style={{ display: 'block', height: 10, width: `${m}%`, background: MATERIALS }} />
            <i style={{ display: 'block', height: 10, width: `${margin}%`, background: under ? 'var(--bg-red-100, var(--border))' : 'transparent' }} />
            <span style={{ position: 'absolute', top: -2, width: 0, height: 14, borderLeft: '2px dashed var(--text-muted)', left: `${100 - s.targetMarginPct}%` }} title={`target margin ${s.targetMarginPct}%`} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            <span>Margin, what is left</span>
            <b style={{ color: under ? 'var(--text-red-700)' : 'inherit', fontVariantNumeric: 'tabular-nums' }}>{margin}%{under ? ` · under the ${s.targetMarginPct}% target` : ''}</b>
          </div>
        </div>
        {line ? <LearningLineRow line={line} canSet={canSet} onTake={() => setDraft(applyLearningLine(s, line))} /> : null}
      </div>
    )
  }

  return (
    <div style={{ padding: '0.9rem 1rem', display: 'grid', gap: 10 }} data-testid="line-budget-settings">
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        The split a typed line gets until the owner tunes it, and the cost rate the hours use. Lines priced on the workbench carry their own and ignore this. Save moves only lines still assumed.
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap' }} aria-hidden>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: LABOR, marginRight: 5, verticalAlign: -1 }} />labor</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: MATERIALS, marginRight: 5, verticalAlign: -1 }} />materials</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--border)', marginRight: 5, verticalAlign: -1 }} />margin, what is left ┆ the dashed mark is the {s.targetMarginPct}% target</span>
      </div>

      <div style={card} data-testid="line-budget-rate">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <b style={{ fontSize: '0.9rem' }}>Cost rate</b>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            <b style={{ fontSize: '1rem' }}>${s.rateUsd}</b> <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>per hour, burdened</span>
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 72px', gap: 10, alignItems: 'center' }}>
          <input type="range" min={20} max={150} step={0.5} value={s.rateUsd} disabled={!canSet} aria-label="Cost rate per hour" onChange={(e) => setDraft(applySettingsRate(s, Number(e.target.value)))} style={{ width: '100%', margin: 0, accentColor: LABOR, height: 28 }} />
          <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 2 }}>
            $<input type="text" inputMode="decimal" value={s.rateUsd} readOnly={!canSet} aria-label="Cost rate per hour, typed" onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) setDraft(applySettingsRate(s, v)) }} style={{ ...pctBox, width: 46 }} />
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          <span>{rosterRate != null ? `The roster ran $${rosterRate.toFixed(2)} an hour over the last ${CREW_RATE_WINDOW_DAYS} days, burdened.` : 'The roster’s rate reads here once the ledger has field hours.'}</span>
          {canSet && rosterRate != null && Math.abs(rosterRate - s.rateUsd) >= 0.5 ? <button type="button" style={link} onClick={() => setDraft(applySettingsRate(s, Math.round(rosterRate * 10) / 10))}>Use the roster’s rate</button> : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--text-muted)', alignItems: 'center' }}>
          <span>Target margin, the dashed mark on every bar</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <input type="text" inputMode="numeric" value={s.targetMarginPct} readOnly={!canSet} aria-label="Target margin percent" onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v !== '') setDraft(applySettingsTarget(s, Number(v))) }} style={pctBox} />
            <span>%</span>
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
        <span>Read each split on a line of</span>
        {LINE_SIZES.map((n) => (
          <button key={n} type="button" style={chip(lineUsd === n)} onClick={() => setLineUsd(n)} aria-pressed={lineUsd === n}>
            {usd0(n)}
          </button>
        ))}
      </div>

      {LINE_SPLIT_KINDS.map(kindRow)}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <span data-testid="line-budget-saved-words">{!loaded ? 'Reading the saved splits…' : changes.any ? `${changes.kinds.length + (changes.rate ? 1 : 0) + (changes.target ? 1 : 0)} change${changes.kinds.length + (changes.rate ? 1 : 0) + (changes.target ? 1 : 0) === 1 ? '' : 's'} not saved yet.` : savedAt ? `Saved ${dayLabel(savedAt)}. Nothing changed yet.` : 'Nothing changed yet.'}</span>
        <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {canSet && changes.any ? <button type="button" style={link} onClick={() => setDraft(null)}>Back to what you saved</button> : null}
          {canSet ? (
            <button type="button" disabled={!changes.any || saving} onClick={() => void save()} style={btn(true, !changes.any || saving)} data-testid="line-budget-save">
              {lineBudgetSettingsSaveWords(changes)}
            </button>
          ) : (
            <span>Only the owner changes these.</span>
          )}
        </span>
      </div>
    </div>
  )
}

function LearningLineRow({ line, canSet, onTake }: { line: LearningLine; canSet: boolean; onTake: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.76rem', padding: '0.4rem 0.6rem', borderRadius: 8, background: 'var(--bg-subtle)' }} data-testid={`learning-line-${line.kind}`}>
      <span>{line.words}</span>
      {canSet ? <button type="button" style={link} onClick={onTake}>Use {line.laborPct}%</button> : null}
    </div>
  )
}
