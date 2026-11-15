import { affidavitGateMissingWord, type LienAffidavitGate, type LienAffidavitPile } from './lienDeskAffidavits'

/**
 * The five gate marks a Lien affidavits list row wears (v2.7335, the owner's ask of 2026-11-15):
 * the pane's gate list folded to one dot per gate, in the pane's own order, so the eye learns the slot — 1 owner,
 * 2 legal description, 3 the GC's address, 4 the § 53.056 notice, 5 homestead — and reads a row's holds without
 * opening it. Each mark carries the words a tooltip shows, the pane's own sentence for a clear gate and the row's
 * *missing …* word for an open one. A job contracted with the owner has no GC to name and no monthly notice to
 * send: `affidavitGates` still fills those two slots, clear, so the strip keeps five marks and draws them as
 * `skipped` — a hollow dot, neither green nor red — with the pane's sentence, rather than two greens for gates
 * nobody passed.
 */
export type LienGateMarkSlot = 'owner' | 'legal' | 'contractor' | 'notice' | 'homestead'
export type LienGateMarkState = 'ok' | 'open' | 'skipped'

export type LienGateMark = {
  slot: LienGateMarkSlot
  state: LienGateMarkState
  /** The tooltip's words: the pane's sentence for a clear or skipped gate, *Missing …* for an open one. */
  title: string
  /** The row's *missing …* word for an open gate, as `affidavitGateMissingWord` says it; absent otherwise. */
  missingWord: string | null
}

export const LIEN_GATE_MARK_SLOTS: ReadonlyArray<LienGateMarkSlot> = ['owner', 'legal', 'contractor', 'notice', 'homestead']

/** The short name a slot goes by in a count's words and an accessible label. */
export const LIEN_GATE_MARK_NAMES: Readonly<Record<LienGateMarkSlot, string>> = {
  owner: 'owner',
  legal: 'legal description',
  contractor: "GC's address",
  notice: '§ 53.056 notice',
  homestead: 'homestead',
}

function slotOf(key: LienAffidavitGate['key']): LienGateMarkSlot {
  return key === 'public_owner' ? 'owner' : key === 'homestead_answer' ? 'homestead' : key
}

/**
 * The five marks from a list entry's gates. `isSub` false is a job contracted with the owner: its contractor and
 * notice slots are skipped, not clear. A gate the entry does not carry (a kernel older than the slot) draws as
 * skipped too, so the strip never shortens.
 */
export function lienGateMarks(gates: ReadonlyArray<LienAffidavitGate>, isSub: boolean): LienGateMark[] {
  return LIEN_GATE_MARK_SLOTS.map((slot) => {
    const gate = gates.find((g) => slotOf(g.key) === slot)
    if (!gate || (!isSub && (slot === 'contractor' || slot === 'notice'))) {
      return { slot, state: 'skipped', title: gate?.label ?? 'Not asked on this job', missingWord: null }
    }
    if (gate.ok) return { slot, state: 'ok', title: gate.label, missingWord: null }
    const missingWord = affidavitGateMissingWord(gate.key)
    return { slot, state: 'open', title: `Missing ${missingWord}`, missingWord }
  })
}

/** The row's *missing …* line, from the marks: `missing a private owner, legal`, or null when every gate is clear. */
export function lienGateMarksMissingWords(marks: ReadonlyArray<LienGateMark>): string | null {
  const words = marks.flatMap((m) => (m.missingWord ? [m.missingWord] : []))
  return words.length ? `missing ${words.join(', ')}` : null
}

/** How the strip reads to a screen reader, and the whole strip's tooltip: `4 of 5 clear · missing a private owner`, or `All 5 clear`. */
export function lienGateMarksSummary(marks: ReadonlyArray<LienGateMark>): string {
  const asked = marks.filter((m) => m.state !== 'skipped').length
  const clear = marks.filter((m) => m.state === 'ok').length
  const missing = lienGateMarksMissingWords(marks)
  if (!missing) return asked === marks.length ? `All ${marks.length} clear` : `All ${asked} asked clear`
  return `${clear} of ${asked} clear · ${missing}`
}

/** The piles whose rows wear the strip: the two where a hold is still possible. Past *To draft* every row has passed, and five greens would say nothing the pile's title did not. */
export const LIEN_GATE_STRIP_PILES: ReadonlyArray<LienAffidavitPile> = ['needs_property', 'to_draft']

/**
 * What a list row draws for its gates: the strip in the two early piles, and the *missing …* words where the strip
 * is not drawn — and on a phone always, since a phone has no hover to read a mark's name from.
 */
export function lienGateRowParts(pile: LienAffidavitPile, phone: boolean): { strip: boolean; words: boolean } {
  const strip = LIEN_GATE_STRIP_PILES.includes(pile)
  return { strip, words: !strip || phone }
}
