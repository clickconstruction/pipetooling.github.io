/**
 * The rows of one revision (moved out of `BidsSubmittalsTab.tsx`, 2026-10-04, the split's step 2):
 * a row per fixture the GC sees — tag, specified, submitted (its parts), status, reason, lead
 * time, cut sheet, what changed since the last revision, their answer — then the order-only
 * fixtures. It draws what it is handed and reports each button; the tab owns the rows and every
 * write.
 */
import { ProductStatusChip } from './ProductStatusChip'
import { SubmittalOrderOnlyRows } from './SubmittalOrderOnlyRows'
import { SubmittalPartsCell } from './SubmittalPartsCell'
import { btn, smallMuted, sub, td, th } from './submittalTabStyles'
import { changeNoteFor } from '../../lib/submittals/buildSubmittalRows'
import { enteredSuffix } from '../../lib/submittals/enteredDecisions'
import type { SubmittalPartRow } from '../../lib/submittals/itemParts'
import { describeLeadTime } from '../../lib/submittals/leadTime'
import { isOrderOnlyRow } from '../../lib/submittals/orderOnly'
import { COLUMN_HELP, REASON_LABELS, needsReason } from '../../lib/submittals/productStatus'
import { rowCallWords, type DecisionSummary } from '../../lib/submittals/reviewDecisions'
import { asDecision, asReason, asStatus, formatPages, formatShortDate, itemToPrevious, needsSheet, type SourceFile, type SubmittalItemRow, type SubmittalRevisionRow } from '../../lib/submittals/submittalRevision'
import { rowSplitTags } from '../../lib/submittals/takeoffCandidates'

export type SubmittalRowsTableProps = {
  /** Every row of the revision: an empty revision says so. */
  items: ReadonlyArray<SubmittalItemRow>
  /** The rows the GC sees, and the order-only ones under them. */
  gcItems: ReadonlyArray<SubmittalItemRow>
  orderOnlyItems: ReadonlyArray<SubmittalItemRow>
  /** Every part on the revision (a call on any of them shows the Their call column) and each row's own. */
  parts: ReadonlyArray<SubmittalPartRow>
  partsOf: ReadonlyMap<string, SubmittalPartRow[]>
  houseNameById: ReadonlyMap<string, string>
  sourceFiles: ReadonlyArray<SourceFile>
  /** The revision before this one, for the Since Rev N column; its rows by id. */
  previousRev: Pick<SubmittalRevisionRow, 'rev_number'> | null
  prevById: ReadonlyMap<string, SubmittalItemRow>
  decisions: Pick<DecisionSummary, 'decided'>
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
}

export function SubmittalRowsTable({ items, gcItems, orderOnlyItems, parts, partsOf, houseNameById, sourceFiles, previousRev, prevById, decisions, isDraft, busy, foldHints, onEdit, onAnswer, onSplit, onFold, onTakeOff, onPutBack, onLeaveOut }: SubmittalRowsTableProps) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflowX: 'auto', background: 'var(--surface)' }} data-tour="submittals-rows">
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
        <thead>
          <tr>
            <th style={th}>Tag</th>
            <th style={th}>Specified</th>
            <th style={th}>Submitted</th>
            <th style={th} title={COLUMN_HELP.status}>Status <span aria-hidden style={{ color: 'var(--text-faint)', fontWeight: 400 }}>?</span></th>
            <th style={th} title={COLUMN_HELP.reason}>Reason <span aria-hidden style={{ color: 'var(--text-faint)', fontWeight: 400 }}>?</span></th>
            <th style={th}>Lead time</th>
            <th style={th} title={COLUMN_HELP.sheet}>Sheet <span aria-hidden style={{ color: 'var(--text-faint)', fontWeight: 400 }}>?</span></th>
            {previousRev ? <th style={th}>Since Rev {previousRev.rev_number}</th> : null}
            {decisions.decided > 0 || parts.some((p) => p.review_decision) ? <th style={th}>Their call</th> : null}
            <th style={th} />
          </tr>
        </thead>
        <tbody data-testid="submittal-rows">
          {items.length === 0 ? (
            <tr>
              <td style={td} colSpan={9}>
                <span style={smallMuted}>No rows on this revision.</span>
              </td>
            </tr>
          ) : null}
          {gcItems.map((it) => {
            const status = asStatus(it.status)
            const reason = asReason(it.reason_kind)
            const lead = describeLeadTime(it.lead_time_days)
            const file = it.sheet_file != null ? sourceFiles[it.sheet_file] ?? null : null
            const prev = it.carried_from_item_id ? prevById.get(it.carried_from_item_id) ?? null : null
            const note = previousRev ? changeNoteFor(prev ? itemToPrevious(prev) : null, { submittedModel: it.submitted_model, submittedLabel: it.submitted_label, status, reasonKind: reason }) : null
            const specText = [it.specified_manufacturer, it.specified_model].filter(Boolean).join(' ')
            return (
              <tr key={it.id} data-testid="submittal-row" style={{ background: status === 'design_change' ? 'var(--bg-red-tint)' : undefined }}>
                <td style={{ ...td, fontWeight: 700, color: it.tag.trim() ? 'var(--text-strong)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{it.tag.trim() || '—'}</td>
                <td style={td}>
                  {specText || (it.tag.trim() ? '—' : <span style={smallMuted}>not on the schedule</span>)}
                  {it.specified_description ? <span style={sub}>{it.specified_description}</span> : null}
                </td>
                <td style={td}>
                  {(partsOf.get(it.id) ?? []).length > 0 ? (
                    <SubmittalPartsCell parts={partsOf.get(it.id) ?? []} houseNameById={houseNameById} />
                  ) : (
                    <>
                      {it.submitted_label ?? it.submitted_model ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      {it.submitted_label && it.submitted_model && it.submitted_label !== it.submitted_model ? <span style={sub}>{it.submitted_model}</span> : null}
                      {it.supply_house_id && houseNameById.get(it.supply_house_id) ? <span style={sub} data-testid="row-house">{houseNameById.get(it.supply_house_id)}</span> : null}
                    </>
                  )}
                </td>
                <td style={td}>
                  <ProductStatusChip status={status} size="md" />
                </td>
                <td style={td}>
                  {reason ? REASON_LABELS[reason] : needsReason(status) ? <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>say why</span> : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  {it.reason_note ? <span style={sub}>{it.reason_note}</span> : null}
                </td>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{lead ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                <td style={td}>
                  {file && (it.sheet_pages ?? []).length > 0 ? (
                    <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>
                      ✓ {formatPages(it.sheet_pages)}
                      <span style={sub}>{file.name}</span>
                    </span>
                  ) : needsSheet(it) ? (
                    <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>sheet needed</span>
                  ) : (
                    <span style={{ color: 'var(--text-faint)' }}>—</span>
                  )}
                </td>
                {previousRev ? <td style={{ ...td, color: note ? 'var(--text-amber-700)' : 'var(--text-faint)', fontWeight: note ? 600 : 400 }}>{note ?? 'carried'}</td> : null}
                {decisions.decided > 0 || parts.some((p) => p.review_decision) ? (
                  <td style={td} data-testid="their-call">
                    {(() => {
                      const d = asDecision(it.review_decision)
                      // 2026-10-03 · one word only when every part got the same answer; otherwise the cell counts ("1 of 3 rejected · 2 with no answer yet").
                      const w = rowCallWords(d, partsOf.get(it.id) ?? [])
                      if (!w) return <span style={{ color: 'var(--text-faint)' }}>—</span>
                      const color = w.tone === 'approved' ? 'var(--text-green-700)' : w.tone === 'revise' ? 'var(--text-amber-700)' : w.tone === 'rejected' ? 'var(--text-red-700)' : 'var(--text-muted)'
                      return (
                        <span style={{ color, fontWeight: 600 }}>
                          <span data-testid="their-call-head">{w.head}</span>
                          {w.rest ? <span style={sub} data-testid="their-call-parts">{w.rest}</span> : null}
                          <span style={sub}>{[it.reviewed_by_name, enteredSuffix(it), formatShortDate(it.reviewed_at)].filter(Boolean).join(' · ')}</span>
                          {it.review_note ? <span style={sub}>“{it.review_note}”</span> : null}
                        </span>
                      )
                    })()}
                  </td>
                ) : null}
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button type="button" aria-label={`Edit ${it.tag.trim() || 'accessory'}`} onClick={() => onEdit(it)} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>
                    Edit
                  </button>
                  {isOrderOnlyRow(it) ? null : (
                    <button type="button" aria-label={`Their answer on ${it.tag.trim() || 'accessory'}`} disabled={busy} onClick={() => onAnswer(it)} title="Record what the reviewer said about this row, part by part. Nobody is emailed." style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem', marginLeft: '0.3rem' }} data-testid="their-answer-row">
                      Their answer
                    </button>
                  )}
                  {isDraft && rowSplitTags(it.tag).length > 1 ? (
                    <button type="button" aria-label={`Split ${it.tag.trim()}`} disabled={busy} onClick={() => onSplit(it)} title={`One row per tag: ${rowSplitTags(it.tag).join(', ')}`} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem', marginLeft: '0.3rem', borderColor: '#2563eb', color: 'var(--text-blue-700)' }} data-testid="split-row">
                      Split
                    </button>
                  ) : null}
                  {isDraft && !it.source_count_row_id && (partsOf.get(it.id) ?? []).length === 0 && items.length > 1 ? (
                    <button type="button" aria-label={`Make ${it.tag.trim() || 'this row'} a part of another row`} disabled={busy} onClick={() => onFold(it.id, foldHints.find((h) => h.fromId === it.id)?.intoId ?? null)} title="Fold this row into another row's fixture, as one of its parts" style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem', marginLeft: '0.3rem' }} data-testid="fold-row">
                      Part of…
                    </button>
                  ) : null}
                  {isDraft ? (
                    <button type="button" aria-label={`Remove ${it.tag.trim() || 'accessory'}`} disabled={busy} onClick={() => onTakeOff(it)} title="Take it off the submittal: order only, or left out" style={{ ...btn, padding: '0.2rem 0.5rem', fontSize: '0.75rem', marginLeft: '0.3rem', color: 'var(--text-muted)' }}>
                      ×
                    </button>
                  ) : null}
                </td>
              </tr>
            )
          })}
          <SubmittalOrderOnlyRows
            items={orderOnlyItems}
            partsOf={partsOf}
            houseNameById={houseNameById}
            columns={8 + (previousRev ? 1 : 0) + (decisions.decided > 0 || parts.some((p) => p.review_decision) ? 1 : 0)}
            isDraft={isDraft}
            busy={busy}
            onPutBack={onPutBack}
            onEdit={onEdit}
            onLeaveOut={onLeaveOut}
          />
        </tbody>
      </table>
    </div>
  )
}
