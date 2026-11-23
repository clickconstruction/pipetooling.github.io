/**
 * *Find a part or a box on any job* on a phone (v2.8291): one hit as a row.
 *
 * At a computer a hit is a row of six columns: the part, the box, the job, how many are on hand, when the box was
 * last counted, and a press. On a phone the last four sat off the right edge. Here a hit is one press that reads
 * down: what was found, the box it is in and where that box stands, the job, and how the box's count stands, with
 * how many are on hand as a figure of its own at the row's end.
 *
 * The words are the table's own. Nothing is searched here: `findOnSite` finds, and the caller reads each box's last
 * count from the store. Pure.
 */
import { boxKindWords } from './editBox'
import { flowFigure } from './flowRow'
import type { OnSiteFindHit } from './onSiteFind'

export type FindPhoneRow = {
  /** One row a hit: a box, and the line in it that matched when one did. */
  key: string
  /** The part that matched, or the box's own name when the box itself matched. */
  title: string
  /** The part's maker, or '' when it has none or the hit is the box. */
  maker: string
  /** The box a part is in, by name. Empty on a box's own row, where the name is the title. */
  boxLabel: string
  /** What the box is and where it stands: `cage · North yard · by the gate`. `delivered` for the row a delivery lands in. */
  boxWords: string
  jobWords: string
  /** How many are on hand, or null on a box's own row, which counts no one part. */
  onHand: string | null
  /** How the box's count stands, or '' for the row a delivery lands in, which is never counted. */
  countWords: string
  /** The box is due a count: its words are drawn in amber. */
  due: boolean
  /** What the press is called: `Open G12 on 224 · Phase 2 draws`. */
  openLabel: string
}

/** The words the row says when a box matched by its own name, where a part's row names the part. */
export const FIND_PHONE_ON_HAND = 'on hand'

/**
 * A hit as a phone's row. `count` is the box's last count as the caller read it: its words (`lastCountWords`) and
 * whether it is due. The row a delivery lands in is never counted, so it says nothing about a count.
 */
export function findPhoneRow(hit: OnSiteFindHit, count: { words: string; due: boolean }): FindPhoneRow {
  const c = hit.container
  const unsorted = c.kind === 'unsorted'
  const boxWords = [unsorted ? 'delivered' : boxKindWords(c.kind).toLowerCase(), hit.place, c.where].map((w) => (w ?? '').trim()).filter(Boolean).join(' · ')
  return {
    key: `${c.id}:${hit.line?.partKey ?? ''}`,
    title: hit.line ? hit.line.partName : c.label,
    maker: hit.line ? (hit.line.manufacturer ?? '').trim() : '',
    boxLabel: hit.line ? c.label : '',
    boxWords,
    jobWords: hit.jobLabel,
    onHand: hit.line ? flowFigure(hit.line.onHand) : null,
    countWords: unsorted ? '' : count.words,
    due: !unsorted && count.due,
    openLabel: `Open ${c.label} on ${hit.jobLabel}`,
  }
}
