/**
 * What this desk holds (punch list #187, PR 3): the ? at the end of a desk's top bar and the card
 * behind it, the Messages page's shape (v2.5802) made general. One kernel of words a desk, each a
 * `DeskLegend`: one row a part of the desk, the part's name and one sentence of what it holds, and
 * a door to the desk's guide as the last row. A row says what the part holds, never how to do a
 * step; the how is the guide's. `deskLegendFailures` holds every row to the plain-words rules, refuses
 * a row that opens on a command, and checks the guide against the registry, so a renamed guide or a
 * sentence over twenty words fails CI (`deskLegends.test.ts`). Pure; the components live in
 * `components/help/LegendCard.tsx` and `LegendButton.tsx`.
 */
import { helpGuideHref } from '../helpGuideAnchors'
import { plainWordsFailures } from '../plainWords'

export interface LegendRow {
  key: string
  /** The part's name as the screen prints it. */
  label: string
  /** One or two plain sentences of what the part holds. */
  note: string
  /** A color stripe beside the name, the part's own color on the desk; none draws the border's grey. */
  accent?: string
  /** Where the row shows; a row with none shows on both. */
  where?: 'desk' | 'phone'
}

export interface DeskLegend {
  /** The desk's key, in the `legend_opened` row's target and the first-press key: `lien-desk`. */
  key: string
  /** The button's name and the card's: *What this desk holds*. */
  label: string
  rows: LegendRow[]
  /** The door row: the guide's slug and its title as the registry holds it. */
  guide: { slug: string; title: string }
}

export const LEGEND_WORDS = {
  button: '?',
  tip: 'Opens a card that says what each part of this desk holds.',
  closeTip: 'Closes the card.',
  close: 'Close',
  readGuide: (title: string): string => `Read the guide: ${title} →`,
  /** The door opens the guide beside the desk, so the desk and anything half typed on it stay. */
  guideTip: 'Opens the guide in a new tab. The desk stays as it is.',
  /** The dot on a ? the person has not pressed yet. */
  firstTip: 'New here? This card says what each part of the desk holds.',
} as const

/** `ui_nav_clicks.control` for a press on a desk's ?; the target is `#<desk key>`. */
export const LEGEND_OPENED_CONTROL = 'legend_opened'

export function legendOpenedTarget(key: string): string {
  return `#${key}`
}

/** The rows a width shows, in order. */
export function legendRowsFor(legend: DeskLegend, phone: boolean): LegendRow[] {
  return legend.rows.filter((r) => !r.where || r.where === (phone ? 'phone' : 'desk'))
}

/** The door's address: the guide, with `via=legend` so the Usage readout counts the open as the card's. */
export function legendGuideHref(legend: DeskLegend): string {
  return helpGuideHref(legend.guide.slug, null, 'legend')
}

/** A sentence that opens on a command belongs in the guide, not on the card. */
const COMMAND_OPENERS = /^(Press|Open|Tap|Type|Pick|Set|Click|Drag|Save|Send|Choose|Go|Use)\b/

/**
 * Every failure a legend has: a row's sentence over twenty words or glued, a row that opens on a
 * command, an empty label, a missing or renamed guide. An empty list is a pass.
 */
export function deskLegendFailures(legend: DeskLegend, guides: ReadonlyMap<string, string>): string[] {
  const out: string[] = []
  if (!legend.key || !/^[a-z0-9-]+$/.test(legend.key)) out.push(`${legend.key || '(no key)'}: the key is a lowercase slug`)
  if (legend.rows.length === 0) out.push(`${legend.key}: no rows`)
  for (const r of legend.rows) {
    if (!r.label.trim()) out.push(`${legend.key} · ${r.key}: no label`)
    for (const f of plainWordsFailures(r.note)) out.push(`${legend.key} · ${r.key}: ${f}`)
    if (COMMAND_OPENERS.test(r.note.trim())) out.push(`${legend.key} · ${r.key}: opens on a command, which is the guide's job: ${r.note}`)
  }
  const title = guides.get(legend.guide.slug)
  if (title === undefined) out.push(`${legend.key}: no guide at ${legend.guide.slug}`)
  else if (title !== legend.guide.title) out.push(`${legend.key}: the guide's title is "${title}", not "${legend.guide.title}"`)
  for (const f of plainWordsFailures(LEGEND_WORDS.tip)) out.push(`tip: ${f}`)
  return out
}
