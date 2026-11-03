/**
 * What the marks on the History look mean (the owner, 2026-11-02, pointing at the glyph column:
 * *what do these icons mean?*). Every line on the Development page's History wears one glyph for
 * its kind, toned by family: grey for words a person wrote, blue for a move on a record, green for
 * money and a yes, red for a no, amber for what went out or came in. Nothing on the page said so
 * beyond a hover title, which a phone never shows. This is the one table both the feed's badge and
 * the legend window read, so the two cannot drift. Pure; the window is
 * `components/developments/HistoryLegendWindow.tsx`.
 */
import { HISTORY_CHIPS, HISTORY_SOURCES, type HistoryChip, type HistorySource } from './history'
import type { ChangeKind } from './whatChanged'

/** The colour family a mark belongs to; the component maps a tone to the theme's tokens. */
export type MarkTone = 'grey' | 'blue' | 'green' | 'red' | 'amber'

export type HistoryMark = { glyph: string; tone: MarkTone }

/** One row of the legend: the mark, its name, what the line records, and the chip it sits under. */
export type HistoryLegendRow = { key: string; mark: HistoryMark; name: string; words: string; chip: HistoryChip }

const KIND_MARK: Record<Exclude<ChangeKind, 'entry'>, HistoryMark> = {
  note: { glyph: '✎', tone: 'grey' },
  stage: { glyph: '◆', tone: 'blue' },
  new_job: { glyph: '◆', tone: 'blue' },
  new_bid: { glyph: '◆', tone: 'blue' },
  plans: { glyph: '▤', tone: 'blue' },
  paid: { glyph: '$', tone: 'green' },
  billed: { glyph: '➤', tone: 'green' },
  won: { glyph: '✓', tone: 'green' },
  lost: { glyph: '✕', tone: 'red' },
  sent: { glyph: '➤', tone: 'amber' },
  contact: { glyph: '➤', tone: 'amber' },
  asked: { glyph: '?', tone: 'amber' },
  answered: { glyph: '↩', tone: 'green' },
}

/** The mark a line wears: a kept entry wears its source's glyph, grey for a note and amber for what happened; every other kind its own. */
export function historyMark(kind: ChangeKind, source?: HistorySource | null): HistoryMark {
  if (kind === 'entry') {
    const src = source ?? 'note'
    return { glyph: HISTORY_SOURCES.find((s) => s.key === src)?.glyph ?? '✎', tone: src === 'note' ? 'grey' : 'amber' }
  }
  return KIND_MARK[kind]
}

export const HISTORY_LEGEND_TITLE = 'What the marks mean'
export const HISTORY_LEGEND_PRESS = 'What the marks mean'
export const HISTORY_LEGEND_INTRO = 'Every line wears one mark for what it records. The colour is its family. The chips under the search box narrow the list by the same families.'

/** The legend, in the order the chips run: what people wrote, what happened, plans, stages, money, questions. */
export const HISTORY_LEGEND: ReadonlyArray<HistoryLegendRow> = [
  { key: 'note', mark: historyMark('note'), name: 'A note', words: 'Words a person or a robot wrote about a job, a bid, the site or the customer.', chip: 'wrote' },
  { key: 'email', mark: historyMark('entry', 'email'), name: 'An email', words: 'An email came in or went out, kept at its own time.', chip: 'happened' },
  { key: 'call', mark: historyMark('entry', 'call'), name: 'A call', words: 'A call, either way.', chip: 'happened' },
  { key: 'text', mark: historyMark('entry', 'text'), name: 'A text', words: 'A text message, either way.', chip: 'happened' },
  { key: 'on_site', mark: historyMark('entry', 'on_site'), name: 'On site', words: 'Something seen or said on the site.', chip: 'happened' },
  { key: 'letter', mark: historyMark('entry', 'letter'), name: 'A letter', words: 'Paper: a letter, a notice or a form.', chip: 'happened' },
  { key: 'plans', mark: historyMark('plans'), name: 'Plans', words: 'A plan set came in or changed.', chip: 'plans' },
  { key: 'stage', mark: historyMark('stage'), name: 'A move', words: 'A job or a bid moved to a new status or stage, or a new job or bid was made.', chip: 'stages' },
  { key: 'sent', mark: historyMark('sent'), name: 'Sent or reached', words: 'A bid went out, or the customer was reached and the contact was logged.', chip: 'stages' },
  { key: 'won', mark: historyMark('won'), name: 'Won', words: 'The bid was won.', chip: 'stages' },
  { key: 'lost', mark: historyMark('lost'), name: 'Lost', words: 'The bid was lost.', chip: 'stages' },
  { key: 'billed', mark: historyMark('billed'), name: 'Billed', words: 'A bill went out on a job.', chip: 'money' },
  { key: 'paid', mark: historyMark('paid'), name: 'Paid', words: 'A payment came in.', chip: 'money' },
  { key: 'asked', mark: historyMark('asked'), name: 'Asked', words: 'A question went to the estimators or to Dispatch.', chip: 'questions' },
  { key: 'answered', mark: historyMark('answered'), name: 'Answered', words: 'That question got its answer.', chip: 'questions' },
]

/** The chip's label a row sits under, for the legend's last column. */
export function legendChipLabel(chip: HistoryChip): string {
  return HISTORY_CHIPS.find((c) => c.key === chip)?.label ?? ''
}

/** The legend grouped by chip, in chip order, so the window reads as the chips run. */
export function legendByChip(): Array<{ chip: HistoryChip; label: string; rows: HistoryLegendRow[] }> {
  return HISTORY_CHIPS.filter((c) => c.key !== 'all')
    .map((c) => ({ chip: c.key, label: c.label, rows: HISTORY_LEGEND.filter((r) => r.chip === c.key) }))
    .filter((g) => g.rows.length > 0)
}
