/**
 * A fact row Edit Job opens on, scrolls to and rings for a moment (v2.3697):
 * the Lien desk's door to a plain value on the notice. 'gc' is the GC row;
 * 'lien-contract' (v2.3753) is *Our contract on this job* — the lien clock,
 * the retainage the GC holds and the payment bond. 'address' is the Job Address box, the door
 * from an address with no street number (punch list #439): ringed, never focused, since a
 * focus there reads the lists and a blur may ask the map.
 */
export type JobFormFocusRow = 'gc' | 'lien-contract' | 'status' | 'pct' | 'address'

/** The rows `JobFormEditFactRows` owns; 'status' (the status stepper), 'pct' (the % done field, on the Bill tab) and 'address' are the form's own (v2.3819, the GC run's chips). */
export const JOB_FORM_FACT_ROWS: ReadonlyArray<JobFormFocusRow> = ['gc', 'lien-contract']

export function isJobFormFactRow(row: JobFormFocusRow | null | undefined): row is 'gc' | 'lien-contract' {
  return row === 'gc' || row === 'lien-contract'
}
