import { useState, type CSSProperties } from 'react'
import { useOptionalAuth } from '../../hooks/useAuth'
import { useLineBudgets } from '../../hooks/useLineBudgets'
import { useLineBudgetSettings } from '../../hooks/useLineBudgetSettings'
import {
  applyLineSplit,
  calcLineBudget,
  lineBudgetColumnsFor,
  lineBudgetEntryOf,
  lineBudgetFor,
  lineSplitKindOf,
  LINE_BUDGET_GLYPH,
  LINE_SPLIT_KIND_WORDS,
  type LineBudgetColumns,
  type LineBudgetEntry,
  type LineBudgetWrite,
} from '../../lib/jobs/lineBudgets'

/**
 * Line budgets on ① Line Items (punch list #234 PR 1, v2.6300), in two pieces the
 * grid places itself: the quiet line under a line item's name (the source glyph,
 * a two-part bar, the numbers, the press), and the panel that opens as a full-width
 * row under the line — labor and materials sliders, the margin reading out under
 * them, every drag saving by itself the way the rest of Edit Job does: the grid
 * writes the five budget columns onto the row and the fixtures autosave carries
 * them. The owner tunes; the office sees the same sliders read-only. Nothing
 * reaches a customer.
 */
const usd0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const LABOR = '#2563eb'
const MATERIALS = '#f59e0b'

const quiet: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: '0.7rem', color: 'var(--text-muted)', background: 'none', border: 'none', padding: '2px 4px 2px 0', textAlign: 'left', cursor: 'pointer', font: 'inherit', borderRadius: 4, maxWidth: '100%', minWidth: 0 }
const barWrap: CSSProperties = { display: 'inline-flex', width: 56, height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--border)', flexShrink: 0 }
const panel: CSSProperties = { margin: '0 0 6px', padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', display: 'grid', gap: 8 }
const rowGrid: CSSProperties = { display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr) 56px minmax(110px, auto)', gap: 10, alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }
const pctBox: CSSProperties = { width: 34, border: 'none', borderBottom: '1px dashed var(--border-strong)', background: 'none', font: 'inherit', fontWeight: 700, fontSize: '0.82rem', textAlign: 'right', padding: '0 1px', color: 'inherit' }
const readBar: CSSProperties = { position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--border)', display: 'flex' }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem' }

function useCanTune(): boolean {
  const role = useOptionalAuth()?.role
  return role === 'dev' || role === 'master_technician'
}

type LineProps = {
  fixtureId: string
  name: string
  /** Count × unit price. */
  priceUsd: number
  /** The row's five budget columns, as the form carries them. */
  row: LineBudgetColumns
}

/** The quiet line under the name: tap it and the panel row opens under the line. */
export function LineBudgetQuietLine({ fixtureId, name, priceUsd, row }: LineProps) {
  const canTune = useCanTune()
  const { settings } = useLineBudgetSettings()
  const { openId, open } = useLineBudgets()
  const entry = lineBudgetFor(lineBudgetEntryOf(row), name, settings)
  const c = calcLineBudget(priceUsd, entry, settings)
  const isOpen = openId === fixtureId
  const tail = entry.source === 'assumed' ? 'assumed' : entry.source === 'tuned' ? 'tuned' : ''
  return (
    <button type="button" data-testid="line-budget" onClick={() => open(isOpen ? null : fixtureId, isOpen ? null : entry)} aria-expanded={isOpen} title={canTune ? 'Tune this line’s budget in place' : 'See this line’s budget'} style={quiet}>
      <span style={{ fontWeight: 700 }}>{LINE_BUDGET_GLYPH[entry.source]}</span>
      <span style={barWrap} aria-hidden>
        <i style={{ display: 'block', height: 5, width: `${entry.laborPct}%`, background: LABOR, opacity: entry.source === 'assumed' ? 0.55 : 1 }} />
        <i style={{ display: 'block', height: 5, width: `${entry.materialsPct}%`, background: MATERIALS, opacity: entry.source === 'assumed' ? 0.55 : 1 }} />
      </span>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
        {Math.round(c.laborHours)} h · {usd0(c.laborUsd)} labor · {usd0(c.materialsUsd)} mat.{tail ? ` · ${tail}` : ''}
      </span>
      <span style={{ color: canTune ? 'var(--text-link)' : 'var(--text-muted)', fontSize: isOpen ? '0.7rem' : canTune ? '0.8rem' : '0.7rem', flexShrink: 0 }}>{isOpen ? '▴' : canTune ? '✎' : '▾'}</span>
    </button>
  )
}

type PanelProps = LineProps & {
  /** Writes the five budget columns onto the row; the grid's `updateFixtureRow`. */
  onChange: (columns: ReturnType<typeof lineBudgetColumnsFor>) => void
  /**
   * The brush (punch list #234 PR 1b): how many other assumed lines the job has, and the write that
   * carries this line's split onto them, answering with the undo. The grid supplies it.
   */
  brush?: { others: number; apply: (columns: LineBudgetWrite) => () => void } | null
}

/** The panel, rendered by the grid as its own row under the line while that line is open. */
export function LineBudgetPanel({ fixtureId, name, priceUsd, row, onChange, brush = null }: PanelProps) {
  const canTune = useCanTune()
  const { settings } = useLineBudgetSettings()
  const { base, open } = useLineBudgets()
  const [brushed, setBrushed] = useState<{ n: number; undo: () => void } | null>(null)
  const entry = lineBudgetFor(lineBudgetEntryOf(row), name, settings)
  const c = calcLineBudget(priceUsd, entry, settings)
  const kind = lineSplitKindOf(name)
  const sourceWords = entry.source === 'workbench' ? "from the bid's workbench" : entry.source === 'assumed' ? `assumed at the company's ${LINE_SPLIT_KIND_WORDS[kind]} split` : 'tuned by the owner'
  const changed = base != null && (base.laborPct !== entry.laborPct || base.materialsPct !== entry.materialsPct)
  const close = () => open(null, null)
  const setEntry = (next: LineBudgetEntry | null) => onChange(lineBudgetColumnsFor(next, settings))
  const move = (field: 'labor' | 'materials', value: number) => {
    if (!canTune || !base) return
    const next = applyLineSplit(entry, field, value)
    const differs = next.laborPct !== base.laborPct || next.materialsPct !== base.materialsPct
    setEntry({ ...next, source: differs ? 'tuned' : base.source, tunedAt: differs ? new Date().toISOString() : base.tunedAt ?? null })
  }
  const backToBase = () => {
    if (!base) return
    setEntry(base.source === 'assumed' ? null : base)
  }
  const backToCompany = () => {
    setEntry(null)
    open(fixtureId, lineBudgetFor(undefined, name, settings))
  }
  const runBrush = () => {
    if (!canTune || !brush || brush.others === 0) return
    const undo = brush.apply(lineBudgetColumnsFor({ laborPct: entry.laborPct, materialsPct: entry.materialsPct, source: 'tuned', tunedAt: new Date().toISOString() }, settings))
    setBrushed({ n: brush.others, undo })
  }
  const undoBrush = () => {
    brushed?.undo()
    setBrushed(null)
  }

  const sliderRow = (field: 'labor' | 'materials', label: string, color: string, pct: number, max: number, words: string) => (
    <div style={rowGrid}>
      <span style={{ fontWeight: 600, color }}>{label}</span>
      <input type="range" min={0} max={max} step={1} value={pct} disabled={!canTune} aria-label={`${name} ${label.toLowerCase()} percent`} onChange={(e) => move(field, Number(e.target.value))} style={{ width: '100%', margin: 0, accentColor: color, height: 28, opacity: canTune ? 1 : 0.7 }} />
      <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 2, fontVariantNumeric: 'tabular-nums' }}>
        <input type="text" inputMode="numeric" value={pct} readOnly={!canTune} aria-label={`${name} ${label.toLowerCase()} percent, typed`} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v !== '') move(field, Number(v)) }} style={{ ...pctBox, color }} />
        <span>%</span>
      </span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'inherit', whiteSpace: 'nowrap' }}>{words}</span>
    </div>
  )

  return (
    <div style={panel} data-testid="line-budget-panel">
      {sliderRow('labor', 'Labor', LABOR, entry.laborPct, 100, `${usd0(c.laborUsd)} · ${Math.round(c.laborHours)} h at $${settings.rateUsd}`)}
      {sliderRow('materials', 'Materials', MATERIALS, entry.materialsPct, 100 - entry.laborPct, usd0(c.materialsUsd))}
      <div style={{ display: 'grid', gap: 3 }}>
        <div style={readBar} aria-hidden>
          <i style={{ display: 'block', height: 8, width: `${entry.laborPct}%`, background: LABOR }} />
          <i style={{ display: 'block', height: 8, width: `${entry.materialsPct}%`, background: MATERIALS }} />
          <i style={{ display: 'block', height: 8, width: `${c.marginPct}%`, background: c.underTarget ? 'var(--bg-red-100, var(--border))' : 'transparent' }} />
          <span style={{ position: 'absolute', top: -2, width: 0, height: 12, borderLeft: '2px dashed var(--text-muted)', left: `${100 - settings.targetMarginPct}%` }} title={`target margin ${settings.targetMarginPct}%`} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>Margin, what is left</span>
          <span style={{ whiteSpace: 'nowrap' }}>
            <b style={{ color: c.underTarget ? 'var(--text-red-700)' : 'inherit', fontVariantNumeric: 'tabular-nums' }}>{c.marginPct}% · {usd0(c.marginUsd)}</b>
            {c.underTarget ? <span style={{ color: 'var(--text-red-700)' }}> · under the {settings.targetMarginPct}% target</span> : null}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <span style={{ fontWeight: 600, color: changed ? 'var(--text-green-700)' : 'inherit' }}>{changed ? 'Saved · ✎ tuned by you' : `${LINE_BUDGET_GLYPH[entry.source]} ${sourceWords}`}</span>
        <span style={{ display: 'flex', gap: 14 }}>
          {canTune && changed && base ? (
            <button type="button" style={link} onClick={backToBase}>Back to {LINE_BUDGET_GLYPH[base.source]} {base.laborPct} / {base.materialsPct}</button>
          ) : canTune && entry.source === 'tuned' ? (
            <button type="button" style={link} onClick={backToCompany}>Back to ≈ the company split {settings.splits[kind][0]} / {settings.splits[kind][1]}</button>
          ) : null}
          <button type="button" style={link} onClick={close}>{canTune ? 'Done' : 'Close'}</button>
        </span>
      </div>
      {canTune && brush && (brush.others > 0 || brushed) ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--text-muted)' }} data-testid="line-budget-brush">
          {brushed ? (
            <>
              <span style={{ fontWeight: 600, color: 'var(--text-green-700)' }}>Brushed onto {brushed.n} {brushed.n === 1 ? 'line' : 'lines'} · each reads ✎ tuned</span>
              <button type="button" style={link} onClick={undoBrush}>Undo</button>
            </>
          ) : (
            <button type="button" style={link} onClick={runBrush} title="Carry this split onto every other line on the job still assumed; a workbench line or one you tuned keeps its own">
              Brush onto the {brush.others} other assumed {brush.others === 1 ? 'line' : 'lines'}
            </button>
          )}
        </div>
      ) : null}
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{canTune ? 'Every drag saves by itself. The Costs tab reads it at once. The customer never sees this.' : 'Only the owner tunes a budget.'}</div>
    </div>
  )
}
