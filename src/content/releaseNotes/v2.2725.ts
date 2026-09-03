import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2725',
  date: '2026-09-03',
  title: 'Cost lines follow your tags on Review and Job Summary, and tags can be merged',
  kind: 'feature',
  highlights: [
    'People → Review and Jobs → Job Summary now draw a cost line for every tag with "Show as its own cost line" ticked — Fuel & gas out of the box, and any tag you tick, such as Government for permits. The verdict bar, the math drawer and the Parts cell all use the same lines, in the tag’s own color.',
    'A purchase lands in a line by its accounting label’s tag first, then by the bank’s category — so a card charge counts as fuel the moment the bank files it that way, and follows the label once one is applied.',
    'The Tags manager gains Merge into…: pick another tag and every category, label and rule moves over before the old tag goes away. Nothing stops matching.',
  ],
}

export default note
