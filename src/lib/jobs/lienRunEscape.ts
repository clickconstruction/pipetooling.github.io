import { recipientViaDocsmit, type RunNotice, type RunRecipient } from './lienDeskRun'

/**
 * Esc and a click outside the run window (v2.5530). Esc peels one layer at a time: a write in flight or a window
 * over the run that closes on Esc by itself (the preview, the Docsmit review) keeps the key; a sign pad or pen pane
 * on a card makes Esc wait, so a drawing is never dropped; the take-back question and an open More ▾ close first.
 * Then the run closes only while nothing in it has changed since it opened. Anything that closing would lose holds
 * it open, and the × still closes it.
 */
export type RunHold = 'docsmit' | 'typed' | 'changed'
export type RunEscapeState = { busy: boolean; overlayOpen: boolean; signing: boolean; takeBackOpen: boolean; moreOpen: boolean; hold: RunHold | null }
export type RunEscapeAction = 'ignore' | 'wait-signing' | 'close-take-back' | 'close-more' | 'hold' | 'close'

export function runEscapeAction(s: RunEscapeState): RunEscapeAction {
  if (s.busy || s.overlayOpen) return 'ignore'
  if (s.signing) return 'wait-signing'
  if (s.takeBackOpen) return 'close-take-back'
  if (s.moreOpen) return 'close-more'
  if (s.hold) return 'hold'
  return 'close'
}

type HeldFields = Pick<RunRecipient, 'method' | 'tracking' | 'courtesy' | 'via' | 'pieceId' | 'pieceStatus'>
// The office's own choices. Docsmit's fields count only through a send that went (the `docsmit` hold): a batch that
// stopped or failed leaves its pieces prepared or failed, mailing nothing, and the card shows no change to keep.
const sameChoice = (a: HeldFields, b: HeldFields) => a.method === b.method && Boolean(a.courtesy) === Boolean(b.courtesy)

/**
 * What closing the run now would lose, against what it opened with, or null when nothing would be lost.
 * `docsmit`: a copy went through Docsmit in this sitting, paid for and not yet recorded — the strongest reason.
 * `typed`: a tracking number differs from the one it opened with (padding ignored).
 * `changed`: a send method, a courtesy tick, the Mailed on day against the day the run opened, Combine, a Saved copy
 * line or a checklist box on an envelope still in the run. Only the notices still in the run are compared, so a partial
 * record leaves its recorded ones out. Signatures are not counted: signing saves at once.
 */
export function runHoldSinceOpen(
  opened: ReadonlyArray<Pick<RunNotice, 'itemId' | 'recipients'>>,
  current: ReadonlyArray<Pick<RunNotice, 'itemId' | 'recipients'>>,
  extras: { mailedOn: string; openedYmd: string; combine: boolean; docUrl: string; docNote: string; ticks: ReadonlyArray<ReadonlyArray<boolean>> },
): RunHold | null {
  const before = new Map<string, HeldFields>()
  for (const n of opened) for (const r of n.recipients) before.set(`${n.itemId}:${r.key}`, r)
  let typed = false
  let changed = false
  for (const n of current) {
    for (const r of n.recipients) {
      const b = before.get(`${n.itemId}:${r.key}`)
      if (recipientViaDocsmit(r) && !(b && recipientViaDocsmit(b))) return 'docsmit'
      if (!b) {
        changed = true
        continue
      }
      if ((r.tracking ?? '').trim() !== (b.tracking ?? '').trim()) typed = true
      if (!sameChoice(r, b)) changed = true
    }
  }
  if (typed) return 'typed'
  if (changed || extras.combine || extras.mailedOn !== extras.openedYmd || extras.docUrl.trim() || extras.docNote.trim()) return 'changed'
  if (extras.ticks.some((row) => row.some(Boolean))) return 'changed'
  return null
}

/** The toast a hold shows. */
export function runHoldWords(hold: RunHold): string {
  if (hold === 'docsmit') return 'Envelopes went through Docsmit in this run. Record the run so the desk keeps them. The × closes it without recording.'
  if (hold === 'typed') return 'The run stays open over the numbers you typed. Record the run, or press × to close it anyway.'
  return 'The run stays open over your changes. Record the run, or press × to close it anyway.'
}
