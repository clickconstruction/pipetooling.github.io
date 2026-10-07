/**
 * The rows of one revision (moved out of `BidsSubmittalsTab.tsx`, 2026-10-04, the split's step 2):
 * a row per fixture the GC sees, then the order-only fixtures. It draws what it is handed and
 * reports each button; the tab owns the rows and every write.
 *
 * Redrawn 2026-10-05 (`rowsTableModel`):
 * - **Two fixed shapes.** A bid built from the takeoff has no schedule to compare to, so its table
 *   is Fixture · Product and parts · Cut sheet; a row's status shows only when it is not the
 *   Proposed every row has. A bid with a schedule keeps Tag · Specified · Submitted and reads
 *   status, reason and lead time in one Status cell.
 * - **Each part is a line with the reviewer's answer beside it** (`SubmittalRowProducts`), under a
 *   *Their answer* heading drawn once any answer exists.
 * - **The row's verdict sits under its buttons** (*1 of 3 rejected*, who, the day): one column for
 *   what they said and what you do about it. A long note wraps at 15rem instead of widening it.
 * - **The step's counts are chips that filter** (the chips and which one is on are this
 *   component's own state), and what every row shares — Proposed, one house — is said once.
 * - **Their answer, Part of… and × sit behind ⋯** (v2.4687: the answer door's home is step 6, so the row offers it once, behind the menu; Part of… and × on a draft only); Edit and Split stay out.
 * - **Save PDF** under a row's cut sheet pages saves just those pages (`rowCutSheet`).
 * - On a phone each row is a card (`.sub-rows-table` in `index.css`); nothing scrolls sideways.
 */
import { useState } from 'react'
import { ProductStatusChip } from './ProductStatusChip'
import { SubmittalOrderOnlyRows } from './SubmittalOrderOnlyRows'
import { SubmittalRowProducts } from './SubmittalRowProducts'
import { btn, smallMuted, sub, td, th } from './submittalTabStyles'
import { changeNoteFor } from '../../lib/submittals/buildSubmittalRows'
import { enteredSuffix } from '../../lib/submittals/enteredDecisions'
import type { SubmittalPartRow } from '../../lib/submittals/itemParts'
import { describeLeadTime } from '../../lib/submittals/leadTime'
import { isOrderOnlyRow } from '../../lib/submittals/orderOnly'
import { COLUMN_HELP, REASON_LABELS, needsReason } from '../../lib/submittals/productStatus'
import { rowCallWords, type DecisionSummary } from '../../lib/submittals/reviewDecisions'
import { commonHouseId, proposedWords, rowAnswers, rowFilterChips, rowMatchesFilter, rowsTableShape, type RowFilterKey } from '../../lib/submittals/rowsTableModel'
import { asDecision, asReason, asStatus, formatPages, formatShortDate, itemToPrevious, needsSheet, type SourceFile, type SubmittalItemRow, type SubmittalRevisionRow } from '../../lib/submittals/submittalRevision'
import { rowSplitTags } from '../../lib/submittals/takeoffCandidates'

export type SubmittalRowsTableProps = {
  /** Every row of the revision: an empty revision says so. */
  items: ReadonlyArray<SubmittalItemRow>
  /** The rows the GC sees, and the order-only ones under them. */
  gcItems: ReadonlyArray<SubmittalItemRow>
  orderOnlyItems: ReadonlyArray<SubmittalItemRow>
  /** Every part on the revision (a call on any of them shows the Their answer column) and each row's own. */
  parts: ReadonlyArray<SubmittalPartRow>
  partsOf: ReadonlyMap<string, SubmittalPartRow[]>
  houseNameById: ReadonlyMap<string, string>
  sourceFiles: ReadonlyArray<SourceFile>
  /** The revision before this one, for the Since Rev N column; its rows by id. */
  previousRev: Pick<SubmittalRevisionRow, 'rev_number'> | null
  prevById: ReadonlyMap<string, SubmittalItemRow>
  decisions: Pick<DecisionSummary, 'decided'>
  /** Tags on the bid's schedule: any makes the table the schedule shape. */
  scheduleTags?: number
  isDraft: boolean
  busy: boolean
  /** Hand rows that read like another row's part: the suggested row to fold each into. */
  foldHints: ReadonlyArray<{ fromId: string; intoId: string | null }>
  onEdit: (item: SubmittalItemRow) => void
  onAnswer: (item: SubmittalItemRow) => void
  onSplit: (item: SubmittalItemRow) => void
  onFold: (fromId: string, suggestedIntoId: string | null) => void
  onTakeOff: (item: SubmittalItemRow) => void
  onPutBack: (item: SubmittalItemRow) => void
  onLeaveOut: (item: SubmittalItemRow) => void
  /** Opens the window that types the schedule; absent, the line over a takeoff table has no door. */
  onTypeSchedule?: () => void
  /** Save one row's cut sheet as a PDF of its own; absent, the row has no such door. */
  onSaveSheet?: (item: SubmittalItemRow) => void
  /** The row whose cut sheet is being cut right now: its door reads Saving…. */
  savingSheetId?: string | null
}

const rowBtn = { ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' } as const
const linkBtn = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 'inherit', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' } as const
/** The answer sub-column's header cell; the grid inside the merged cell is this less the cell's padding (`.sub-rows-answers`). */
const ANSWER_WIDTH = '13rem'

export function SubmittalRowsTable({ items, gcItems, orderOnlyItems, parts, partsOf, houseNameById, sourceFiles, previousRev, prevById, decisions, scheduleTags = 0, isDraft, busy, foldHints, onEdit, onAnswer, onSplit, onFold, onTakeOff, onPutBack, onLeaveOut, onTypeSchedule, onSaveSheet, savingSheetId = null }: SubmittalRowsTableProps) {
  const [filter, setFilter] = useState<RowFilterKey>('all')
  const [moreOpen, setMoreOpen] = useState<ReadonlySet<string>>(() => new Set())
  const shape = rowsTableShape(gcItems, scheduleTags)
  const showAnswers = decisions.decided > 0 || parts.some((p) => p.review_decision)
  const chips = rowFilterChips(gcItems)
  // A chip that emptied (the last sheet was added) falls back to every row.
  const active: RowFilterKey = chips.some((c) => c.key === filter) ? filter : 'all'
  const shownRows = active === 'all' ? gcItems : gcItems.filter((it) => rowMatchesFilter(active, it))
  const houseId = commonHouseId(gcItems, partsOf)
  const houseName = houseId ? houseNameById.get(houseId) ?? null : null
  const proposed = shape === 'takeoff' ? proposedWords(gcItems) : ''
  const columns = (shape === 'schedule' ? 6 : 4) + (showAnswers ? 1 : 0) + (previousRev ? 1 : 0)
  const toggleMore = (id: string) => setMoreOpen((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const help = <span aria-hidden style={{ color: 'var(--text-faint)', fontWeight: 400 }}>?</span>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }} data-tour="submittals-rows">
      {chips.length > 0 ? (
        <div role="group" aria-label="Show rows" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }} data-testid="row-filters">
          {chips.map((c) => {
            const on = c.key === active
            return (
              <button key={c.key} type="button" aria-pressed={on} onClick={() => setFilter(c.key)} style={{ padding: '0.15rem 0.65rem', borderRadius: 999, border: `1px solid ${on ? '#2563eb' : 'var(--border-strong)'}`, background: on ? '#2563eb' : 'var(--surface)', color: on ? 'white' : 'var(--text-strong)', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}>
                {c.label} {c.count}
              </button>
            )
          })}
        </div>
      ) : null}
      {/* v2.4690 · the one house is said on the procurement log's lens row, not here too (punch list #89, the trims). */}
      {proposed ? (
        <span style={smallMuted} data-testid="rows-said-once">
          {proposed ? (
            <>
              {proposed} because this bid has no schedule to check against.{' '}
              {onTypeSchedule ? <><button type="button" onClick={onTypeSchedule} style={linkBtn}>Type the schedule</button> to change that.{' '}</> : null}
            </>
          ) : null}
        </span>
      ) : null}
      <div className="sub-rows-wrap" style={{ border: '1px solid var(--border)', borderRadius: 6, overflowX: 'auto', background: 'var(--surface)' }}>
        <table className="sub-rows-table" data-shape={shape} style={{ width: '100%', borderCollapse: 'collapse', minWidth: shape === 'schedule' ? 860 : 640 }}>
          <thead>
            <tr>
              <th style={th}>{shape === 'schedule' ? 'Tag' : 'Fixture'}</th>
              {shape === 'schedule' ? <th style={th}>Specified</th> : null}
              <th style={th}>{shape === 'schedule' ? 'Submitted' : 'Product and parts'}</th>
              {showAnswers ? <th className="sub-rows-answer-head" style={{ ...th, width: ANSWER_WIDTH, boxSizing: 'border-box' }}>Their answer</th> : null}
              {shape === 'schedule' ? <th style={th} title={COLUMN_HELP.status}>Status {help}</th> : null}
              <th style={th} title={COLUMN_HELP.sheet}>Cut sheet {help}</th>
              {previousRev ? <th style={th}>Since Rev {previousRev.rev_number}</th> : null}
              <th style={th} />
            </tr>
          </thead>
          <tbody data-testid="submittal-rows">
            {items.length === 0 ? (
              <tr>
                <td style={td} colSpan={columns}>
                  <span style={smallMuted}>No rows on this revision.</span>
                </td>
              </tr>
            ) : null}
            {shownRows.map((it) => {
              const status = asStatus(it.status)
              const reason = asReason(it.reason_kind)
              const lead = describeLeadTime(it.lead_time_days)
              const file = it.sheet_file != null ? sourceFiles[it.sheet_file] ?? null : null
              const prev = it.carried_from_item_id ? prevById.get(it.carried_from_item_id) ?? null : null
              const note = previousRev ? changeNoteFor(prev ? itemToPrevious(prev) : null, { submittedModel: it.submitted_model, submittedLabel: it.submitted_label, status, reasonKind: reason }) : null
              const specText = [it.specified_manufacturer, it.specified_model].filter(Boolean).join(' ')
              const rowParts = partsOf.get(it.id) ?? []
              const name = it.tag.trim() || 'accessory'
              const takeoffName = (it.specified_description ?? '').trim()
              // 2026-10-03 · one word only when every part got the same answer; otherwise it counts ("1 of 3 rejected · 2 with no answer yet").
              const call = rowCallWords(asDecision(it.review_decision), rowParts)
              const callColor = !call ? undefined : call.tone === 'approved' ? 'var(--text-green-700)' : call.tone === 'revise' ? 'var(--text-amber-700)' : call.tone === 'rejected' ? 'var(--text-red-700)' : 'var(--text-muted)'
              const answers = rowAnswers(it, rowParts)
              // The row's own note, when the parts' marks do not already carry it.
              const rowNote = it.review_note && answers.byPart.size > 0 && ![...answers.byPart.values()].some((m) => m.note) ? it.review_note : null
              const statusBlock = (
                <>
                  <ProductStatusChip status={status} size="md" />
                  {reason ? <span style={sub}>{REASON_LABELS[reason]}</span> : needsReason(status) ? <span style={{ ...sub, color: 'var(--text-amber-700)', fontWeight: 600 }}>say why</span> : null}
                  {it.reason_note ? <span style={sub}>{it.reason_note}</span> : null}
                  {lead ? <span style={{ ...sub, fontVariantNumeric: 'tabular-nums' }}>lead time {lead}</span> : null}
                </>
              )
              const canFold = isDraft && !it.source_count_row_id && rowParts.length === 0 && items.length > 1
              const more = moreOpen.has(it.id)
              return (
                <tr key={it.id} data-testid="submittal-row" style={{ background: status === 'design_change' ? 'var(--bg-red-tint)' : undefined }}>
                  <td style={{ ...td, color: 'var(--text-strong)' }}>
                    <b style={{ fontWeight: 700, color: it.tag.trim() ? 'var(--text-strong)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{it.tag.trim() || '—'}</b>
                    {shape === 'takeoff' && takeoffName && takeoffName.toLowerCase() !== it.tag.trim().toLowerCase() ? <span style={sub}>{takeoffName}</span> : null}
                    {/* Proposed is said once over the table; any other status, and a lead time typed on the row, show here. */}
                    {shape === 'takeoff' && status !== 'proposed' ? <span style={{ display: 'block', marginTop: '0.2rem' }} data-testid="row-status">{statusBlock}</span> : shape === 'takeoff' && lead ? <span style={{ ...sub, fontVariantNumeric: 'tabular-nums' }}>lead time {lead}</span> : null}
                  </td>
                  {shape === 'schedule' ? (
                    <td style={td} data-label="Specified">
                      {specText || (it.tag.trim() ? '—' : <span style={smallMuted}>not on the schedule</span>)}
                      {it.specified_description ? <span style={sub}>{it.specified_description}</span> : null}
                    </td>
                  ) : null}
                  <td style={td} colSpan={showAnswers ? 2 : 1}>
                    <SubmittalRowProducts item={it} parts={rowParts} houseNameById={houseNameById} showAnswers={showAnswers} showHouses={!houseName} onAddProduct={() => onEdit(it)} />
                  </td>
                  {shape === 'schedule' ? <td style={td} data-label="Status">{statusBlock}</td> : null}
                  <td style={td} data-label="Cut sheet">
                    {file && (it.sheet_pages ?? []).length > 0 ? (
                      <span style={{ color: 'var(--text-green-700)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        ✓ {formatPages(it.sheet_pages)}
                        {/* One vendor file is named once, on its own line under the table. */}
                        {sourceFiles.length > 1 ? <span style={{ ...sub, whiteSpace: 'normal' }}>{file.name}</span> : null}
                        {/* The row's own pages as a small PDF, to attach to an email or a text. */}
                        {onSaveSheet ? (
                          <button type="button" aria-label={`Save the cut sheet for ${name} as a PDF`} disabled={savingSheetId != null} onClick={() => onSaveSheet(it)} title={`Save ${name}'s cut sheet as a PDF of its own, to attach to an email or a text`} style={{ ...linkBtn, display: 'block', fontSize: '0.75rem', fontWeight: 400, whiteSpace: 'nowrap', cursor: savingSheetId != null ? 'wait' : 'pointer' }} data-testid="save-sheet">
                            {savingSheetId === it.id ? 'Saving…' : 'Save PDF'}
                          </button>
                        ) : null}
                      </span>
                    ) : needsSheet(it) ? (
                      <span style={{ color: 'var(--text-amber-700)', fontWeight: 600, whiteSpace: 'nowrap' }}>sheet needed</span>
                    ) : (
                      <span style={{ color: 'var(--text-faint)' }}>—</span>
                    )}
                  </td>
                  {previousRev ? <td style={{ ...td, color: note ? 'var(--text-amber-700)' : 'var(--text-faint)', fontWeight: note ? 600 : 400 }} data-label={`Since Rev ${previousRev.rev_number}`}>{note ?? 'carried'}</td> : null}
                  <td style={{ ...td, textAlign: 'right' }}>
                    <span className="sub-rows-actions" style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-end' }}>
                    <span style={{ display: 'inline-flex', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                      <button type="button" aria-label={`Edit ${name}`} onClick={() => onEdit(it)} style={rowBtn}>
                        Edit
                      </button>
                      {isDraft && rowSplitTags(it.tag).length > 1 ? (
                        <button type="button" aria-label={`Split ${it.tag.trim()}`} disabled={busy} onClick={() => onSplit(it)} title={`One row per tag: ${rowSplitTags(it.tag).join(', ')}`} style={{ ...rowBtn, borderColor: '#2563eb', color: 'var(--text-blue-700)' }} data-testid="split-row">
                          Split
                        </button>
                      ) : null}
                      {isDraft || !isOrderOnlyRow(it) ? (
                        <button type="button" aria-label={`More for ${name}`} aria-expanded={more} onClick={() => toggleMore(it.id)} title={isDraft ? (canFold ? 'Their answer, make it a part of another row, or take it off the submittal' : 'Their answer, or take it off the submittal') : 'Their answer'} style={{ ...rowBtn, color: 'var(--text-muted)', fontWeight: 700 }} data-testid="row-more">
                          ⋯
                        </button>
                      ) : null}
                    </span>
                      {more ? (
                        <span style={{ display: 'inline-flex', gap: '0.3rem', whiteSpace: 'nowrap' }} data-testid="row-more-buttons">
                          {/* v2.4687 · the door's home is step 6; the row keeps one behind ⋯ (punch list #89, item 4). */}
                          {isOrderOnlyRow(it) ? null : (
                            <button type="button" aria-label={`Their answer on ${name}`} disabled={busy} onClick={() => onAnswer(it)} title="Record what the reviewer said about this row, part by part. Nobody is emailed." style={rowBtn} data-testid="their-answer-row">
                              Their answer
                            </button>
                          )}
                          {isDraft && canFold ? (
                            <button type="button" aria-label={`Make ${it.tag.trim() || 'this row'} a part of another row`} disabled={busy} onClick={() => onFold(it.id, foldHints.find((h) => h.fromId === it.id)?.intoId ?? null)} title="Fold this row into another row's fixture, as one of its parts" style={rowBtn} data-testid="fold-row">
                              Part of…
                            </button>
                          ) : null}
                          {isDraft ? (
                            <button type="button" aria-label={`Remove ${name}`} disabled={busy} onClick={() => onTakeOff(it)} title="Take it off the submittal: order only, or left out" style={{ ...rowBtn, color: 'var(--text-muted)' }}>
                              × Take off…
                            </button>
                          ) : null}
                        </span>
                      ) : null}
                      {/* The row's verdict under the button that records it, where who and when fit on one line. */}
                      {call ? (
                        <span className="sub-rows-call" style={{ display: 'block', maxWidth: '15rem', textAlign: 'right', color: callColor, fontWeight: 600, fontSize: '0.75rem' }} data-testid="their-call">
                          <span data-testid="their-call-head">{call.head}</span>
                          {call.rest ? <span style={sub} data-testid="their-call-parts">{call.rest}</span> : null}
                          <span style={sub}>{[it.reviewed_by_name, enteredSuffix(it), formatShortDate(it.reviewed_at)].filter(Boolean).join(' · ')}</span>
                          {rowNote ? <span style={sub}>“{rowNote}”</span> : null}
                        </span>
                      ) : null}
                    </span>
                  </td>
                </tr>
              )
            })}
            {active === 'all' ? (
              <SubmittalOrderOnlyRows
                items={orderOnlyItems}
                partsOf={partsOf}
                houseNameById={houseNameById}
                columns={columns}
                isDraft={isDraft}
                busy={busy}
                onPutBack={onPutBack}
                onEdit={onEdit}
                onLeaveOut={onLeaveOut}
              />
            ) : null}
          </tbody>
        </table>
      </div>
      {active !== 'all' ? (
        <span style={smallMuted} data-testid="row-filter-note">
          Showing {shownRows.length} of {gcItems.length} rows. <button type="button" onClick={() => setFilter('all')} style={linkBtn}>Show all</button>
        </span>
      ) : null}
    </div>
  )
}
