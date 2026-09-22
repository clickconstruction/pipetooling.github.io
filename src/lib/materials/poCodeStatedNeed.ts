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
 *
 * v2.3718: the question moves to AFTER the code. The box before Generate was
 * never filled (none of the codes minted after v2.3599 carried a claim; one
 * real claim in five months) — the office mints first, the tech is asking for
 * a number, not offering a list. So the just-minted card asks while the tech is
 * still on the line, and any ledger row with nothing written down reads
 * "add what it was for…". Both write through `set_material_po_generator_stated_need`.
 */

/** The form label on both doors. */
export const STATED_NEED_LABEL = 'What they said they need'

/** The ledger column header (desktop table) and the inline label (phone list). */
export const STATED_NEED_COLUMN = 'Said they need'

/** The placeholder on both doors — concrete, so the box asks for the material and not for "notes". */
export const STATED_NEED_PLACEHOLDER = 'e.g. 40 ft of ¾" PEX and two stop valves · a 2" drain machine · "just fittings"'

/** The question on the just-minted card, asked while the tech is still on the line (v2.3718). */
export const STATED_NEED_ASK_AFTER = 'What did they say they need?'

/** The link on a ledger row with nothing written down. */
export const STATED_NEED_ADD_LINK = 'add what it was for…'

/** The link beside a claim that is already written down. */
export const STATED_NEED_CHANGE_LINK = 'change'

/** The save button under the box — it writes their words down, it does not "submit". */
export const STATED_NEED_SAVE_LABEL = 'Write it down'

/** The one shape a claim is stored in: trimmed, and null when blank — what the RPC does with NULLIF(btrim()). */
export function normalizeStatedNeed(text: string | null | undefined): string | null {
  const t = (text ?? '').trim()
  return t ? t : null
}

/**
 * The ledger after one row's claim was written down — the row keeps its place
 * (both ledgers are newest-first; a rewrite must not reorder or refetch).
 */
export function withStatedNeed<T extends { id: string; notes: string | null }>(rows: readonly T[], id: string, notes: string | null): T[] {
  return rows.map((r) => (r.id === id ? { ...r, notes: normalizeStatedNeed(notes) } : r))
}

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
