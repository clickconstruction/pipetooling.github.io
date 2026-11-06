/**
 * Punch list #271, PR 3: the Ours or Rental choice and a rental's fields, shared by the fleet board's + Add a machine
 * (which the label page reuses for a code the board does not know) and the block editor's A machine not on the board
 * yet. A rental has no unit of ours: its label is minted by `mintRentalLabel` from what is typed here, and the
 * agreement number may stay blank until the tech photographs the paper at pickup.
 */
import type { CSSProperties } from 'react'
import type { RentalDraft } from '../../lib/machines/machines'

/** The two presses, the chosen one filled; each form hands in its own press styles so the piece matches its neighbours. */
export function OursOrRental({ ours, onChange, disabled, press, chosen }: { ours: boolean; onChange: (ours: boolean) => void; disabled?: boolean; press: CSSProperties; chosen: CSSProperties }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem' }} role="group" aria-label="Ours or a rental">
      <button type="button" style={ours ? chosen : press} aria-pressed={ours} disabled={disabled} onClick={() => onChange(true)}>
        Ours
      </button>
      <button type="button" style={ours ? press : chosen} aria-pressed={!ours} disabled={disabled} onClick={() => onChange(false)}>
        Rental
      </button>
    </div>
  )
}

/** Who it is from, the agreement number and the due-back day, as cells of the form's own grid. */
export function RentalFields({ value, onChange, disabled, field }: { value: RentalDraft; onChange: (v: RentalDraft) => void; disabled?: boolean; field: CSSProperties }) {
  return (
    <>
      <input value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} placeholder="Rented from, like Sunbelt" aria-label="Rented from" disabled={disabled} style={field} />
      <input value={value.agreementNo} onChange={(e) => onChange({ ...value, agreementNo: e.target.value })} placeholder="Agreement number, or blank until the photo" aria-label="Agreement number" disabled={disabled} style={field} />
      <label style={{ display: 'grid', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        Due back
        <input type="date" value={value.dueBack} onChange={(e) => onChange({ ...value, dueBack: e.target.value })} aria-label="Due back" disabled={disabled} style={field} />
      </label>
    </>
  )
}
