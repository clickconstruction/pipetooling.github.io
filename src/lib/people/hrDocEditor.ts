/**
 * People → HR's editor for the summary and the narrative (v2.6609): the payload its Save sends to
 * dev_person_doc_write (migration 20261107013000, the same function the dev seat's plan_person_doc /
 * apply_person_doc write through), the words beside the Save press, and the one refusal the editor reads
 * specially — the document saved by someone else since it was opened. Pure: no io.
 */
export type HrDocKind = 'summary' | 'narrative'
/** What the editor is on: one of the fixed two, or a named document (v2.6614, punch list #277). */
export type HrDocTarget = HrDocKind | 'document'

export type HrDocSavePayload = {
  person_id: string
  kind: HrDocKind
  /** The whole text; the function archives the prior version. */
  markdown: string
  /** The updated_at the editor loaded, so a save over a version kept since is refused; absent for a document that does not exist yet. */
  expect_updated_at?: string
}

/** The body of the save: `{ p, p_dry_run: false }` goes to the RPC as the seat sends it. */
export function hrDocSavePayload(args: { personId: string; kind: HrDocKind; markdown: string; loadedUpdatedAt: string | null }): HrDocSavePayload {
  const p: HrDocSavePayload = { person_id: args.personId, kind: args.kind, markdown: args.markdown }
  if (args.loadedUpdatedAt) p.expect_updated_at = args.loadedUpdatedAt
  return p
}

export type HrDocDraftState = {
  /** False while the draft reads exactly as the document does; Save is dead then. */
  changed: boolean
  /** One line beside the presses. */
  words: string
}

/** What Save would do, in words: nothing yet, an emptied document, or the size and how it moved. */
export function hrDocDraftWords(kind: HrDocTarget, draft: string, original: string): HrDocDraftState {
  if (draft === original) return { changed: false, words: 'Nothing changed yet.' }
  if (draft.trim() === '') return { changed: true, words: `Save empties the ${kind}. The prior version stays in its history.` }
  const n = draft.length
  const d = n - original.length
  const moved = d === 0 ? 'the same count as before' : d > 0 ? `${d.toLocaleString('en-US')} more than before` : `${(-d).toLocaleString('en-US')} fewer than before`
  return { changed: true, words: `Save keeps ${n.toLocaleString('en-US')} characters, ${moved}. The prior version stays in its history.` }
}

/** The function's own refusal when the row's updated_at moved since the editor loaded it. */
export function hrDocSaveWasStale(message: string): boolean {
  return /was saved at .+ after the version you loaded/.test(message)
}

/** The toast after a refusal: the reason, and for a stale save the one way out. */
export function hrDocSaveFailureWords(kind: HrDocTarget, reason: string): string {
  const base = `Could not save the ${kind}: ${reason}`
  return hrDocSaveWasStale(reason) ? `${base} Copy your words, press Cancel, open it again and bring them over.` : base
}
