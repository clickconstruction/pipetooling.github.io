import type { CSSProperties } from 'react'
import { formatDenverTimeOnly } from '../../utils/dateUtils'
import { tallyHistoryMadeAt, type TallyQueueCard } from '../../lib/tally/tallyTeamQueue'
import type { StaleStaffRow } from '../../lib/tally/teamPurchaseRows'
import { tallyUndoLineFromWindowRow, type TallyUndoLine } from '../../lib/tally/tallyUndoLine'
import type { TallyChoice, TallyLineSuggestion, TallySuggestion } from '../../lib/tally/tallySortSuggestion'
import {
  choiceKey,
  dayChipPressed,
  type TallyLineSelection,
  type TallySelections,
} from '../../lib/tally/tallyTeamSelections'
import {
  tallyCategoryWords,
  tallyChoiceWords,
  tallyDayEvidenceWords,
  tallySuggestionWhy,
  type TallyJobLabel,
} from '../../lib/tally/tallySuggestionWords'

export type TallyTeamDayCardProps = {
  card: TallyQueueCard
  label: TallyJobLabel
  selections: TallySelections
  lineErrors: ReadonlyMap<string, string>
  busy: boolean
  backchargeBusyId: string | null
  /** Charges whose undo is being written. */
  undoBusyIds: ReadonlySet<string>
  onPickDay: (chip: TallySuggestion) => void
  onPickLine: (chargeId: string, choice: TallyChoice | null) => void
  onToggleByHours: (chargeId: string) => void
  onSortDay: () => void
  onAnotherJob: (row: StaleStaffRow) => void
  onInvoices: (row: StaleStaffRow) => void
  onBackcharge: (row: StaleStaffRow) => void
  /** Put a sorted line that went to jobs back on the card to sort. */
  onUndo: (line: TallyUndoLine) => void
}

const money = (n: number) =>
  Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

const chipStyle = (pressed: boolean): CSSProperties => ({
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  padding: '0.4rem 0.65rem',
  minHeight: 40,
  borderRadius: 8,
  border: pressed ? '2px solid #2563eb' : '1px solid var(--border)',
  background: pressed ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: 'var(--text-700)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
})

const smallButton: CSSProperties = {
  padding: '0.3rem 0.55rem',
  minHeight: 32,
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  fontSize: '0.75rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const linkButton: CSSProperties = {
  padding: 0,
  border: 'none',
  background: 'none',
  color: 'var(--text-blue-700)',
  fontSize: '0.75rem',
  textDecoration: 'underline',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

function LikelyTag() {
  return (
    <span
      style={{
        fontSize: '0.6875rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: 'var(--text-amber-800)',
        background: 'var(--bg-amber-100)',
        borderRadius: 4,
        padding: '0 0.3rem',
      }}
    >
      likely
    </span>
  )
}

function SuggestionChip({
  s,
  label,
  pressed,
  onClick,
}: {
  s: TallySuggestion
  label: TallyJobLabel
  pressed: boolean
  onClick: () => void
}) {
  const why = tallySuggestionWhy(s)
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} style={chipStyle(pressed)} data-testid="tally-team-chip" data-rule={s.rule}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {tallyChoiceWords(s.choice, label)}
        {s.confidence === 'likely' ? <LikelyTag /> : null}
      </span>
      {why ? <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>{why}</span> : null}
    </button>
  )
}

/** The words for what a line will be sorted to, with the split amounts when it is a split. */
function selectionWords(line: TallyLineSuggestion, sel: TallyLineSelection, label: TallyJobLabel): string {
  if (sel.choice.kind === 'job') return `Goes to ${label(sel.choice.jobId)}.`
  const rows = sel.byHours ? line.byHours : line.even
  if (!rows) return sel.byHours ? 'By hours is not possible on this day.' : 'Split evenly.'
  const parts = rows.map((r) => `${money(r.amount)} to ${label(r.jobId)}`)
  return `${sel.byHours ? 'By hours' : 'Split evenly'}: ${parts.join(' and ')}.`
}

function sortedWhere(row: TallyQueueCard['sorted'][number], label: TallyJobLabel): string {
  if (row.splits.length > 0) return row.splits.map((s) => label(s.jobId)).join(' and ')
  if (row.invoiceLinks.length > 0) return row.invoiceLinks.length === 1 ? 'an invoice' : `${row.invoiceLinks.length} invoices`
  return 'payroll'
}

export function TallyTeamDayCard({
  card,
  label,
  selections,
  lineErrors,
  busy,
  backchargeBusyId,
  undoBusyIds,
  onPickDay,
  onPickLine,
  onToggleByHours,
  onSortDay,
  onAnotherJob,
  onInvoices,
  onBackcharge,
  onUndo,
}: TallyTeamDayCardProps) {
  const selectedCount = card.charges.filter((c) => selections.has(c.charge.id)).length
  const lineById = new Map(card.suggestion.lines.map((l) => [l.chargeId, l]))
  const chipPressed = (chip: TallySuggestion) => dayChipPressed(selections, card, chip)
  const n = card.charges.length

  return (
    <section
      data-testid="tally-team-day-card"
      aria-label={`${card.holderName}, ${n} ${n === 1 ? 'charge' : 'charges'}`}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--surface)',
        padding: '0.75rem',
        marginBottom: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.9375rem' }}>
          <strong>{card.holderName}</strong>
          <span style={{ color: 'var(--text-muted)' }}>
            {` · ${n} ${n === 1 ? 'charge' : 'charges'}`}
            {card.sorted.length > 0 ? ` · ${card.sorted.length} sorted` : ''}
          </span>
        </div>
        <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(card.total)}</div>
      </div>

      <p data-testid="tally-team-evidence" style={{ margin: '0.35rem 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-slate-500)', lineHeight: 1.45 }}>
        {tallyDayEvidenceWords(card.suggestion, label)}
      </p>

      {card.suggestion.chips.length > 0 ? (
        <div role="group" aria-label="Sort the whole day to" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
          {card.suggestion.chips.map((chip) => (
            <SuggestionChip key={choiceKey(chip.choice)} s={chip} label={label} pressed={chipPressed(chip)} onClick={() => onPickDay(chip)} />
          ))}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {card.charges.map(({ row, charge }) => {
          const line = lineById.get(charge.id)
          const sel = selections.get(charge.id)
          const error = lineErrors.get(charge.id)
          const options: TallySuggestion[] = [...(line?.own ?? []), ...card.suggestion.chips]
          const seen = new Set<string>()
          const uniqueOptions = options.filter((o) => {
            const k = choiceKey(o.choice)
            if (seen.has(k)) return false
            seen.add(k)
            return true
          })
          return (
            <div
              key={charge.id}
              data-testid="tally-team-line"
              style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8125rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{formatDenverTimeOnly(Date.parse(charge.madeAt))}</span>
                  <strong>{charge.counterparty || 'Unknown store'}</strong>
                  {charge.category ? (
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{tallyCategoryWords(charge.category)}</span>
                  ) : null}
                </div>
                <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {charge.amount > 0 ? `${money(charge.amount)} back` : money(charge.amount)}
                </div>
              </div>

              {line && line.own.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                  {line.own.map((o) => (
                    <SuggestionChip
                      key={choiceKey(o.choice)}
                      s={o}
                      label={label}
                      pressed={sel != null && choiceKey(sel.choice) === choiceKey(o.choice)}
                      onClick={() => onPickLine(charge.id, o.choice)}
                    />
                  ))}
                </div>
              ) : null}

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem' }}>
                <select
                  aria-label={`Job for ${charge.counterparty || 'this charge'}`}
                  value={sel ? choiceKey(sel.choice) : ''}
                  onChange={(e) => {
                    const picked = uniqueOptions.find((o) => choiceKey(o.choice) === e.target.value)
                    onPickLine(charge.id, picked ? picked.choice : null)
                  }}
                  style={{ ...smallButton, maxWidth: '100%' }}
                >
                  <option value="">Pick a job</option>
                  {uniqueOptions.map((o) => (
                    <option key={choiceKey(o.choice)} value={choiceKey(o.choice)}>
                      {tallyChoiceWords(o.choice, label)}
                    </option>
                  ))}
                </select>
                <button type="button" style={smallButton} onClick={() => onAnotherJob(row)}>
                  Another job…
                </button>
                <button type="button" style={smallButton} onClick={() => onInvoices(row)}>
                  Invoices
                </button>
                <button
                  type="button"
                  style={smallButton}
                  disabled={backchargeBusyId === charge.id}
                  onClick={() => onBackcharge(row)}
                >
                  {backchargeBusyId === charge.id ? '…' : 'Backcharge'}
                </button>
              </div>

              {sel && line ? (
                <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-700)' }}>
                  {selectionWords(line, sel, label)}
                  {sel.choice.kind === 'split' && line.byHours ? (
                    <>
                      {' '}
                      <button type="button" style={linkButton} onClick={() => onToggleByHours(charge.id)}>
                        {sel.byHours ? 'Split evenly instead' : 'Split by hours instead'}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
              {error ? (
                <div role="alert" style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>
                  {error}
                </div>
              ) : null}
            </div>
          )
        })}

        {card.sorted.map((h) => {
          const undo = tallyUndoLineFromWindowRow(h)
          const undoing = undoBusyIds.has(h.id)
          return (
            <div
              key={h.id}
              data-testid="tally-team-sorted-line"
              style={{ borderTop: '1px solid var(--border)', paddingTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}
            >
              {formatDenverTimeOnly(Date.parse(tallyHistoryMadeAt(h)))} {h.counterpartyName ?? 'Unknown store'} {money(h.amount)} went to{' '}
              {sortedWhere(h, label)}
              {h.sortedByName ? `, sorted by ${h.sortedByName}` : ''}.
              {undo ? (
                <>
                  {' '}
                  <button
                    type="button"
                    data-testid="tally-team-undo"
                    aria-label={`Undo ${h.counterpartyName ?? 'this charge'} ${money(h.amount)}`}
                    disabled={undoing}
                    onClick={() => onUndo(undo)}
                    style={linkButton}
                  >
                    {undoing ? 'Undoing…' : 'Undo'}
                  </button>
                </>
              ) : null}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.6rem' }}>
        <button
          type="button"
          data-testid="tally-team-sort-day"
          disabled={busy || selectedCount === 0}
          onClick={onSortDay}
          style={{
            padding: '0.5rem 0.9rem',
            minHeight: 40,
            borderRadius: 8,
            border: 'none',
            background: busy || selectedCount === 0 ? 'var(--border)' : '#16a34a',
            color: busy || selectedCount === 0 ? 'var(--text-muted)' : 'white',
            fontWeight: 700,
            cursor: busy || selectedCount === 0 ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {busy ? 'Sorting…' : selectedCount === 0 ? 'Sort the day' : `Sort ${selectedCount} ${selectedCount === 1 ? 'charge' : 'charges'}`}
        </button>
      </div>
    </section>
  )
}
