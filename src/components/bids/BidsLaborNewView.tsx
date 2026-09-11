import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { laborRowHours } from '../../lib/bids/laborRowHours'
import { laborCellAriaLabel } from '../../lib/bids/laborCellSaveState'
import {
  entryAlreadyKnows,
  laborBookEntriesForMatch,
  laborRowSource,
  laborRowsNeedingHours,
  matchLaborRows,
  normalizeFixtureKey,
  type LaborBookMatch,
  type LaborRowSource,
} from '../../lib/bids/laborBookMatch'
import { laborEstimateCompleteness, revenuePerFieldHourWords, summarizeBidLabor, type LaborMaterialsSource } from '../../lib/bids/bidLaborSummary'
import type { CostEstimateLaborRow, LaborBookEntryWithFixture, LaborBookVersion } from '../../lib/bids/bidPricingEngineTypes'

/**
 * The New Labor view (the Labor refresh PR 1 — "Hours that learn").
 *
 * Three parts, top to bottom: the head (is this estimate usable as a job
 * budget, and does the whole bid make sense), the queue (the rows the book
 * could not answer — answer once and the book learns the alias and the
 * hours), and the grid (every row with a chip saying where its hours came
 * from). Cell edits go through the tab's `setRowHours` + `markCell`, so the
 * tab's autosave persists them exactly as in Old; a queue save also writes
 * the row straight away so it is durable whatever the autosave thinks of the
 * other inputs. Reads the bid's APPLIED book (`appliedBookVersionId`), not the
 * one being browsed in the Labor book panel.
 */

const STAGE_KEYS = ['rough_in_hrs_per_unit', 'top_out_hrs_per_unit', 'trim_set_hrs_per_unit'] as const
type StageKey = (typeof STAGE_KEYS)[number]
const STAGE_SHORT: Record<StageKey, string> = { rough_in_hrs_per_unit: 'RI', top_out_hrs_per_unit: 'TO', trim_set_hrs_per_unit: 'TS' }
const STAGE_LONG: Record<StageKey, string> = { rough_in_hrs_per_unit: 'Rough In', top_out_hrs_per_unit: 'Top Out', trim_set_hrs_per_unit: 'Trim Set' }

const SOURCE_WORDS: Record<LaborRowSource, string> = { book: 'book', edited: 'edited', typed: 'typed', none: 'needs hours' }
const VIA_WORDS = { exact: 'by name', alias: 'by alias', prefix: 'by code' } as const

export type BidsLaborNewViewProps = {
  bidId: string
  bidValue: number | null
  rows: CostEstimateLaborRow[]
  ratePerHour: number | null
  materialsSource: LaborMaterialsSource
  /** The bid's applied labor book (the HOURS select) — the book the queue learns into. */
  appliedBookVersionId: string | null
  laborBookVersions: LaborBookVersion[]
  onChangeBook: (versionId: string | null) => void
  /** Optimistic row patch; the tab's autosave persists it (same as Old's cells). */
  setRowHours: (rowId: string, updates: Partial<Pick<CostEstimateLaborRow, StageKey | 'is_fixed'>>) => void
  /** Cell save-state plumbing shared with Old (underline while unsaved). */
  markCell: (key: string) => void
  cellA11y: (key: string, label: string) => Record<string, unknown>
  cellSaveStyle: (key: string) => CSSProperties
  /** Replaces the tab's rows after a direct write (queue saves, fill-from-book). */
  replaceRows: (rows: CostEstimateLaborRow[]) => void
  getOrCreateFixtureTypeId: (name: string) => Promise<{ id: string } | { id: null; error?: string }>
  onFocusRate: () => void
  setError: (message: string | null) => void
  /** Row-jump flash (Pricing → Labor), same id scheme as Old. */
  rowDomId: (fixture: string | null) => string
  rowJumpFlashDomId: string | null
}

type QueueDraft = { entryId: string | 'new' | 'task' | ''; newName: string; hrs: [string, string, string]; saving: boolean }

const tile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.7rem', background: 'var(--surface)', minWidth: 0 }
const tileK: CSSProperties = { fontSize: '0.66rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }
const tileV: CSSProperties = { fontSize: '1.2rem', fontWeight: 600, marginTop: 2, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }
const tileS: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }
const pill = (tone: 'ok' | 'warn' | 'muted' | 'blue' | 'purple'): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '1px 8px',
  borderRadius: 999,
  fontSize: '0.72rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  border: `1px solid ${tone === 'ok' ? '#16a34a' : tone === 'warn' ? '#f59e0b' : tone === 'blue' ? '#2563eb' : tone === 'purple' ? '#7c5cff' : 'var(--border)'}`,
  color: tone === 'ok' ? 'var(--text-green-700)' : tone === 'warn' ? 'var(--text-amber-700)' : tone === 'blue' ? 'var(--text-blue-700)' : tone === 'purple' ? 'var(--text-strong)' : 'var(--text-muted)',
  background: tone === 'blue' ? 'var(--bg-blue-tint)' : 'transparent',
})
const cellInput: CSSProperties = { width: '4.25rem', padding: '0.25rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'center', background: 'var(--surface)', color: 'inherit' }
const btn = (primary = false): CSSProperties => ({
  padding: '0.35rem 0.75rem',
  fontSize: '0.8125rem',
  fontWeight: 600,
  border: `1px solid ${primary ? '#3b82f6' : 'var(--border-strong)'}`,
  borderRadius: 6,
  background: primary ? '#3b82f6' : 'var(--surface)',
  color: primary ? 'white' : 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

const fmtHours = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: n % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })
const hoursOf = (row: CostEstimateLaborRow, key: StageKey) => (row.is_fixed ? Number(row[key]) : Number(row.count) * Number(row[key]))

export function BidsLaborNewView(p: BidsLaborNewViewProps) {
  const [bookEntries, setBookEntries] = useState<LaborBookEntryWithFixture[]>([])
  const [bookLoaded, setBookLoaded] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, QueueDraft>>({})
  const [filling, setFilling] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [showFilled, setShowFilled] = useState(true)

  const loadBook = useCallback(async () => {
    if (!p.appliedBookVersionId) {
      setBookEntries([])
      setBookLoaded(true)
      return
    }
    const { data, error } = await supabase
      .from('labor_book_entries')
      .select('*, fixture_types(name)')
      .eq('version_id', p.appliedBookVersionId)
      .order('sequence_order', { ascending: true })
    if (error) {
      p.setError(`Failed to load the labor book: ${error.message}`)
      setBookEntries([])
    } else setBookEntries((data as LaborBookEntryWithFixture[]) ?? [])
    setBookLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.appliedBookVersionId])
  useEffect(() => {
    setBookLoaded(false)
    void loadBook()
  }, [loadBook])

  const matchEntries = useMemo(() => laborBookEntriesForMatch(bookEntries), [bookEntries])
  const matches = useMemo(() => matchLaborRows(p.rows, matchEntries), [p.rows, matchEntries])
  const queue = useMemo(() => laborRowsNeedingHours(p.rows), [p.rows])
  const filled = useMemo(() => p.rows.filter((r) => !queue.includes(r)), [p.rows, queue])
  const summary = useMemo(() => summarizeBidLabor({ rows: p.rows, ratePerHour: p.ratePerHour, bidValue: p.bidValue }), [p.rows, p.ratePerHour, p.bidValue])
  const completeness = useMemo(() => laborEstimateCompleteness({ rows: p.rows, rateSet: p.ratePerHour != null && p.ratePerHour > 0, materialsSource: p.materialsSource }), [p.rows, p.ratePerHour, p.materialsSource])
  const matchedZero = useMemo(() => queue.filter((r) => matches.get(r.id)), [queue, matches])

  const draftFor = (row: CostEstimateLaborRow): QueueDraft => {
    const d = drafts[row.id]
    if (d) return d
    const m = matches.get(row.id)
    return { entryId: m ? m.entry.id : '', newName: '', hrs: m ? [String(m.entry.rough), String(m.entry.top), String(m.entry.trim)] : ['', '', ''], saving: false }
  }
  const patchDraft = (rowId: string, row: CostEstimateLaborRow, patch: Partial<QueueDraft>) => setDrafts((prev) => ({ ...prev, [rowId]: { ...draftFor(row), ...(prev[rowId] ?? {}), ...patch } }))

  const pickEntry = (row: CostEstimateLaborRow, entryId: string) => {
    const e = matchEntries.find((x) => x.id === entryId)
    patchDraft(row.id, row, { entryId: entryId as QueueDraft['entryId'], hrs: e ? [String(e.rough), String(e.top), String(e.trim)] : draftFor(row).hrs })
  }

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 3500)
  }

  const refetchRows = async (): Promise<CostEstimateLaborRow[] | null> => {
    const ceId = p.rows[0]?.cost_estimate_id
    if (!ceId) return null
    const { data, error } = await supabase.from('cost_estimate_labor_rows').select('*').eq('cost_estimate_id', ceId).order('sequence_order', { ascending: true })
    if (error) {
      p.setError(`Failed to refresh labor rows: ${error.message}`)
      return null
    }
    return (data as CostEstimateLaborRow[]) ?? []
  }

  /** The queue's save: write the row now; learn the alias / the new entry into the applied book. */
  const saveQueueRow = async (row: CostEstimateLaborRow) => {
    const d = draftFor(row)
    const hrs = d.hrs.map((h) => Math.max(0, parseFloat(h) || 0)) as [number, number, number]
    if (hrs.every((h) => h === 0)) {
      p.setError('Give the row at least one stage hour before saving.')
      return
    }
    patchDraft(row.id, row, { saving: true })
    p.setError(null)
    const isTask = d.entryId === 'task'
    const { error: rowErr } = await supabase
      .from('cost_estimate_labor_rows')
      .update({ rough_in_hrs_per_unit: hrs[0], top_out_hrs_per_unit: hrs[1], trim_set_hrs_per_unit: hrs[2], is_fixed: isTask ? true : row.is_fixed })
      .eq('id', row.id)
    if (rowErr) {
      p.setError(`Failed to save hours: ${rowErr.message}`)
      patchDraft(row.id, row, { saving: false })
      return
    }
    let learned: string | null = null
    if (p.appliedBookVersionId && d.entryId && d.entryId !== 'task') {
      if (d.entryId === 'new') {
        const name = d.newName.trim() || (row.fixture ?? '').trim()
        if (name) {
          const created = await p.getOrCreateFixtureTypeId(name)
          if (created.id) {
            const { data: last } = await supabase.from('labor_book_entries').select('sequence_order').eq('version_id', p.appliedBookVersionId).order('sequence_order', { ascending: false }).limit(1)
            const alias = normalizeFixtureKey(name) === normalizeFixtureKey(row.fixture) ? [] : [(row.fixture ?? '').trim()]
            const { error: insErr } = await supabase.from('labor_book_entries').insert({
              version_id: p.appliedBookVersionId,
              fixture_type_id: created.id,
              alias_names: alias,
              rough_in_hrs: hrs[0],
              top_out_hrs: hrs[1],
              trim_set_hrs: hrs[2],
              sequence_order: (last?.[0]?.sequence_order ?? 0) + 1,
            })
            if (insErr) p.setError(`Saved the hours, but the book entry failed: ${insErr.message}`)
            else learned = alias.length ? `added "${name}" to the book with the alias "${alias[0]}"` : `added "${name}" to the book`
          } else p.setError(('error' in created ? created.error : null) ?? `Saved the hours, but could not create the fixture "${name}"`)
        }
      } else {
        const entry = matchEntries.find((e) => e.id === d.entryId)
        if (entry && !entryAlreadyKnows(entry, row.fixture)) {
          const alias = (row.fixture ?? '').trim()
          const { error: aliasErr } = await supabase
            .from('labor_book_entries')
            .update({ alias_names: [...entry.aliases, alias] })
            .eq('id', entry.id)
          if (aliasErr) p.setError(`Saved the hours, but the alias failed: ${aliasErr.message}`)
          else learned = `"${alias}" now reads as ${entry.name} on every bid`
        }
      }
    }
    const fresh = await refetchRows()
    if (fresh) p.replaceRows(fresh)
    if (learned) await loadBook()
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
    flash(learned ? `Saved · ${learned}.` : 'Saved.')
  }

  /** Every matched zero row takes its entry's hours in one go; typed rows are never touched. */
  const fillMatchedFromBook = async () => {
    if (matchedZero.length === 0) return
    setFilling(true)
    p.setError(null)
    for (const row of matchedZero) {
      const m = matches.get(row.id)!
      const { error } = await supabase
        .from('cost_estimate_labor_rows')
        .update({ rough_in_hrs_per_unit: m.entry.rough, top_out_hrs_per_unit: m.entry.top, trim_set_hrs_per_unit: m.entry.trim })
        .eq('id', row.id)
      if (error) {
        p.setError(`Failed to fill ${row.fixture ?? 'a row'}: ${error.message}`)
        break
      }
    }
    const fresh = await refetchRows()
    if (fresh) p.replaceRows(fresh)
    setFilling(false)
    flash(`Filled ${matchedZero.length} row${matchedZero.length === 1 ? '' : 's'} from the book.`)
  }

  const sourceChip = (row: CostEstimateLaborRow, m: LaborBookMatch | null | undefined) => {
    const src = laborRowSource(row, m)
    if (src === 'book' && m) return <span style={pill('blue')} title={`${m.entry.name} · matched ${VIA_WORDS[m.via]}`}>book · {VIA_WORDS[m.via]}</span>
    if (src === 'edited' && m) return <span style={pill('purple')} title={`Book says ${m.entry.rough} / ${m.entry.top} / ${m.entry.trim} for ${m.entry.name}`}>✎ edited · book {m.entry.rough}/{m.entry.top}/{m.entry.trim}</span>
    if (src === 'typed') return <span style={pill('purple')} title="No book entry matches this row; the hours were typed here">✎ typed</span>
    return <span style={pill('warn')}>{SOURCE_WORDS[src]}</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.5rem' }} data-testid="labor-new-view">
      {/* Head: completeness + the strip */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.6rem', flexWrap: 'wrap' }}>
          <b style={{ fontSize: '0.875rem' }}>{completeness.usable ? 'Usable as a job budget' : 'Not yet usable as a job budget'}</b>
          <span aria-hidden style={{ flex: '1 1 160px', height: 7, borderRadius: 4, background: 'var(--bg-200)', overflow: 'hidden', display: 'flex' }}>
            <i style={{ width: `${Math.round(completeness.hoursShare * 100)}%`, background: completeness.usable ? '#16a34a' : '#f59e0b', display: 'block' }} />
          </span>
          {completeness.pills.map((c) => (
            <span key={c.text} style={pill(c.tone)}>
              {c.text}
            </span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
          <div style={tile}>
            <div style={tileK}>Field hours</div>
            <div style={tileV}>{fmtHours(summary.total)}</div>
            <div style={tileS}>RI {fmtHours(summary.rough)} · TO {fmtHours(summary.top)} · TS {fmtHours(summary.trim)}</div>
          </div>
          <div style={tile}>
            <div style={tileK}>Crew-days</div>
            <div style={tileV}>{summary.crewDays.toLocaleString('en-US', { maximumFractionDigits: 1 })}</div>
            <div style={tileS}>2 techs × 8 h</div>
          </div>
          <div style={tile}>
            <div style={tileK}>Labor $</div>
            <div style={tileV}>{summary.laborUsd != null ? `$${formatCurrency(summary.laborUsd)}` : '—'}</div>
            <div style={tileS}>
              {p.ratePerHour != null && p.ratePerHour > 0 ? (
                <>at ${formatCurrency(p.ratePerHour)}/h · <button type="button" onClick={p.onFocusRate} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-blue-700)', cursor: 'pointer', font: 'inherit', fontWeight: 600 }}>edit</button></>
              ) : (
                <button type="button" onClick={p.onFocusRate} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-amber-700)', cursor: 'pointer', font: 'inherit', fontWeight: 600 }}>set a labor rate ↓</button>
              )}
            </div>
          </div>
          <div style={tile}>
            <div style={tileK}>Footage share</div>
            <div style={tileV}>{Math.round(summary.footageHoursShare * 100)}%</div>
            <div style={tileS}>of the hours sit on pipe rows</div>
          </div>
          <div style={tile}>
            <div style={tileK}>Revenue per field hour</div>
            <div style={tileV}>{summary.revenuePerFieldHour != null ? `$${Math.round(summary.revenuePerFieldHour).toLocaleString('en-US')}` : '—'}</div>
            <div style={tileS}>{revenuePerFieldHourWords(summary)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
          <label style={{ color: 'var(--text-muted)' }}>Labor book</label>
          <select value={p.appliedBookVersionId ?? ''} onChange={(e) => p.onChangeBook(e.target.value || null)} style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '11rem', background: 'var(--surface)', color: 'inherit' }} aria-label="Labor book">
            <option value="">— Use defaults —</option>
            {p.laborBookVersions.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          {!p.appliedBookVersionId ? <span style={{ color: 'var(--text-muted)' }}>Pick a book so the queue can learn into it.</span> : null}
          {notice ? <span role="status" style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{notice}</span> : null}
        </div>
      </div>

      {/* The queue */}
      {queue.length > 0 ? (
        <div style={{ border: '1px solid #f59e0b', borderRadius: 10, padding: '0.7rem 0.9rem', background: 'var(--bg-amber-100)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="labor-queue">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
            <b style={{ fontSize: '0.875rem' }}>
              {queue.length} row{queue.length === 1 ? '' : 's'} need{queue.length === 1 ? 's' : ''} hours
            </b>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Answer once and the book learns — an alias you save applies to every future bid.</span>
            {matchedZero.length > 0 ? (
              <button type="button" onClick={() => void fillMatchedFromBook()} disabled={filling} style={{ ...btn(true), marginLeft: 'auto' }}>
                {filling ? 'Filling…' : `Fill ${matchedZero.length} from the book`}
              </button>
            ) : null}
          </div>
          {!bookLoaded && p.appliedBookVersionId ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reading the book…</span> : null}
          {queue.map((row) => {
            const m = matches.get(row.id)
            const d = draftFor(row)
            return (
              <div key={row.id} id={p.rowDomId(row.fixture)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 2fr) auto', gap: '0.4rem 0.8rem', alignItems: 'center', padding: '0.45rem 0', borderTop: '1px solid var(--border-amber-soft)' }}>
                <div style={{ minWidth: 0 }}>
                  <b>{row.fixture ?? ''}</b> <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>×{Number(row.count).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                  <div style={{ fontSize: '0.72rem', color: m ? 'var(--text-blue-700)' : 'var(--text-muted)' }}>{m ? `reads as ${m.entry.name} (${VIA_WORDS[m.via]}) — hours from the book` : 'no match in the book'}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <select value={d.entryId} onChange={(e) => pickEntry(row, e.target.value)} aria-label={`Read ${row.fixture ?? 'row'} as`} style={{ padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, maxWidth: '14rem', background: 'var(--surface)', color: 'inherit', fontSize: '0.8125rem' }}>
                    <option value="">Read as…</option>
                    {matchEntries.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                    <option value="new">New book entry…</option>
                    <option value="task">Task · fixed hours (not a fixture)</option>
                  </select>
                  {d.entryId === 'new' ? (
                    <input type="text" value={d.newName} placeholder={row.fixture ?? 'name'} onChange={(e) => patchDraft(row.id, row, { newName: e.target.value })} aria-label="New book entry name" style={{ padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, width: '11rem', background: 'var(--surface)', color: 'inherit', fontSize: '0.8125rem' }} />
                  ) : null}
                  {STAGE_KEYS.map((k, i) => (
                    <input
                      key={k}
                      type="number"
                      min={0}
                      step={0.25}
                      value={d.hrs[i]}
                      placeholder={STAGE_SHORT[k]}
                      onChange={(e) => {
                        const hrs = [...d.hrs] as [string, string, string]
                        hrs[i] = e.target.value
                        patchDraft(row.id, row, { hrs })
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                      aria-label={laborCellAriaLabel(`${STAGE_LONG[k]} hours per unit`, row.fixture)}
                      style={cellInput}
                    />
                  ))}
                </div>
                <button type="button" onClick={() => void saveQueueRow(row)} disabled={d.saving || !bookLoaded} style={btn(true)}>
                  {d.saving ? 'Saving…' : d.entryId && d.entryId !== 'task' && (d.entryId === 'new' || !entryAlreadyKnows(matchEntries.find((e) => e.id === d.entryId)!, row.fixture)) ? 'Save & learn' : 'Save'}
                </button>
              </div>
            )
          })}
        </div>
      ) : p.rows.length > 0 ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-green-700)', fontWeight: 600 }}>Every row has hours.</div>
      ) : null}

      {/* The grid */}
      {filled.length > 0 ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', borderBottom: showFilled ? '1px solid var(--border)' : undefined }}>
            <button type="button" onClick={() => setShowFilled((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }} aria-expanded={showFilled}>
              <span aria-hidden style={{ fontSize: '0.7rem' }}>{showFilled ? '▼' : '▶'}</span>
              {filled.length} row{filled.length === 1 ? '' : 's'} with hours
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>hours per unit · edits save on their own</span>
          </div>
          {showFilled ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: 'var(--bg-subtle)' }}>
                  <tr>
                    {['Row on the count sheet', 'Count', 'RI', 'TO', 'TS', 'Hours', 'Where the hours came from'].map((h, i) => (
                      <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: i === 0 || i === 6 ? 'left' : 'center', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filled.map((row) => {
                    const m = matches.get(row.id)
                    return (
                      <tr key={row.id} id={p.rowDomId(row.fixture)} style={{ borderBottom: '1px solid var(--border)', background: p.rowJumpFlashDomId != null && p.rowJumpFlashDomId === p.rowDomId(row.fixture) ? 'var(--bg-blue-tint)' : undefined, transition: 'background 400ms ease' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <div style={{ fontWeight: 500 }}>{row.fixture ?? ''}</div>
                          {m && normalizeFixtureKey(m.entry.name) !== normalizeFixtureKey(row.fixture) ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.entry.name}</div> : null}
                          {row.is_fixed ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>fixed hours · not × count</div> : null}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{Number(row.count).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                        {STAGE_KEYS.map((k) => (
                          <td key={k} style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                            <input
                              type="number"
                              min={0}
                              step={0.25}
                              value={row[k]}
                              onChange={(e) => {
                                p.markCell(`labor:${row.id}:${k.replace('_hrs_per_unit', '')}`)
                                p.setRowHours(row.id, { [k]: parseFloat(e.target.value) || 0 } as Partial<Pick<CostEstimateLaborRow, StageKey>>)
                              }}
                              onWheel={(e) => e.currentTarget.blur()}
                              {...p.cellA11y(`labor:${row.id}:${k.replace('_hrs_per_unit', '')}`, laborCellAriaLabel(`${STAGE_LONG[k]} hours per unit`, row.fixture))}
                              style={{ ...cellInput, ...p.cellSaveStyle(`labor:${row.id}:${k.replace('_hrs_per_unit', '')}`) }}
                              title={`${STAGE_LONG[k]} · ${fmtHours(hoursOf(row, k))} h on this row`}
                            />
                          </td>
                        ))}
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtHours(laborRowHours(row))}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{sourceChip(row, m)}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>Totals</td>
                    <td />
                    <td style={{ padding: '0.5rem', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{fmtHours(summary.rough)}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{fmtHours(summary.top)}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{fmtHours(summary.trim)}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{fmtHours(summary.total)}</td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {(['book', 'edited', 'typed'] as const)
                        .map((s) => [s, filled.filter((r) => laborRowSource(r, matches.get(r.id)) === s).length] as const)
                        .filter(([, n]) => n > 0)
                        .map(([s, n]) => `${n} ${SOURCE_WORDS[s]}`)
                        .join(' · ')}
                      {queue.length > 0 ? ` · ${queue.length} pending above` : ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default BidsLaborNewView
