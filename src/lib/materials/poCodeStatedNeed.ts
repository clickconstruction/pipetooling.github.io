/**
 * The claim behind a counter PO code (v2.3599, to-dos/po-generator-stated-need).
 *
 * When the office mints a five-digit code the tech has just said what it is
 * for — "40 ft of ¾" PEX", "a drain machine". `material_po_generator_entries.notes`
 * already held that when anyone typed it; the desktop form called it "Optional
 * notes…" and nothing read it back. Now both doors (Materials → PO Generator,
 * Dispatch Mode → PO) ask for it by name, the text to the tech carries it, and
 * the supply-house invoice form shows it beside the amount. Same column, one
 * wording — every label reads from here.
 */

/** The form label on both doors. */
export const STATED_NEED_LABEL = 'What they said they need'

/** The ledger column header (desktop table) and the inline label (phone list). */
export const STATED_NEED_COLUMN = 'Said they need'

/** The placeholder on both doors — concrete, so the box asks for the material and not for "notes". */
export const STATED_NEED_PLACEHOLDER = 'e.g. 40 ft of ¾" PEX and two stop valves · a 2" drain machine · "just fittings"'

export type PoCodeSummaryInput = {
  code: number
  supplyHouseName: string | null
  jobLabel: string
  personName: string
  /** The claim as typed; blank or null means none was written down. */
  statedNeed: string | null
}

/**
 * The one line the Copy button and the text to the tech carry. The claim goes
 * last so the code, house and job still lead; a blank claim adds nothing.
 */
export function poCodeSummaryLine(r: PoCodeSummaryInput): string {
  const said = (r.statedNeed ?? '').trim()
  return (
    `PO ${r.code}` +
    (r.supplyHouseName ? ` — ${r.supplyHouseName}` : '') +
    ` — ${r.jobLabel} — for ${r.personName}` +
    (said ? ` — ${said}` : '')
  )
}
