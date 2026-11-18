/**
 * The Saved band on a painted map (punch list #392, step 3): what the map's window says the moment
 * a save lands, and whether it offers the text press. Pure.
 *
 * A walk as a leader on 2026-11-18 found that after **Save the map** nothing said saved or what
 * came next, and that **Share** was the last and plainest press. So the window says it was saved,
 * where, and who can open it, and the next press is one blue **Text it from my phone…**.
 */

export type PaintedMapSavedInput = {
  /** The job in words, when the window knows them: `J2417 · Cedar Hollow 12`. */
  jobLabel?: string | null
  /** The development in words, for a map that is for every lot. */
  developmentLabel?: string | null
  onJob: boolean
  onDevelopment: boolean
  /** `about 640 ft · 2 places`, from `mapSummaryWords`. Empty for a map with nothing on it. */
  summary: string
}

/** `Saved on J2417 · Cedar Hollow 12` and the line under it. */
export function paintedMapSavedWords(input: PaintedMapSavedInput): { head: string; under: string } {
  const job = input.jobLabel?.trim()
  const site = input.developmentLabel?.trim()
  const head = input.onJob ? (job ? `Saved on ${job}` : 'Saved on its job') : input.onDevelopment ? (site ? `Saved for ${site}, every lot` : 'Saved for every lot') : 'Saved'
  const who = input.onJob ? 'Anyone on the job can open it.' : input.onDevelopment ? 'It shows on every job in the development.' : 'Only you and the office can open it.'
  const summary = input.summary.trim()
  const said = summary ? `${summary.charAt(0).toUpperCase()}${summary.slice(1)}. ` : ''
  return { head, under: `${said}${who}` }
}

/**
 * Whether the band carries **Text it from my phone…**. The press opens the phone's own Messages, so
 * it is a phone's. A link is its maker's and the office's to hand out, and a map with nothing on it
 * has nothing to show: the same rule as the window's **Share**.
 */
export function paintedMapSavedOffersText(input: { phone: boolean; mayShare: boolean; hasSomething: boolean }): boolean {
  return input.phone && input.mayShare && input.hasSomething
}
