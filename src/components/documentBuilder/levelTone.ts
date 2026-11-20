/**
 * A level's colour in the document builder (punch list #404, the flow of #389): on the slider's track, on the step bar,
 * on the dots beside a breach line and on the small bars beside a level's name. `levelInk` is the same colour for words.
 */
import { PAPER_OFF, stopRank, type PaperDef, type PaperStop } from '../../lib/documentBuilder/documentBuilder'

/** A level's colour, loosest first. The first is the app's own press blue. */
const TONES = ['#2563eb', 'var(--text-teal-700)', 'var(--text-amber-700)', 'var(--text-red-700)']
/** The colour of a stop: grey for Off, then one colour a level. A fifth level and up share the last. */
export function levelTone(def: PaperDef, stop: PaperStop): string {
  if (stop === PAPER_OFF) return 'var(--text-muted)'
  return TONES[Math.min(TONES.length - 1, Math.max(0, stopRank(def, stop) - 1))] ?? 'var(--text-muted)'
}

/** A level's colour for words on the page's own surface, readable in both themes. */
const INKS = ['var(--text-blue-700)', 'var(--text-teal-700)', 'var(--text-amber-800)', 'var(--text-red-700)']
export function levelInk(def: PaperDef, stop: PaperStop): string {
  if (stop === PAPER_OFF) return 'var(--text-muted)'
  return INKS[Math.min(INKS.length - 1, Math.max(0, stopRank(def, stop) - 1))] ?? 'var(--text-muted)'
}
