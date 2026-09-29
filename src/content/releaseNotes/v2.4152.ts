import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4152',
  date: '2026-09-29',
  title: 'Lien calendar: every billed job on one axis, the 15ths as columns, and a to-do the columns write',
  kind: 'feature',
  highlights: [
    'The Lien desk\'s Calendar now draws every billed job on one shared time line, with Texas\'s deadline days — the 15ths — as its columns and one today line down the whole board. A GC\'s row folds its jobs\' flags with a count; open it and each job shows its pay dot, a hollow flag for every unpaid month\'s notice (a check once it is on file), the lien flag, green room or red hatching between them, and a striped bracket where the property kind is not set.',
    'The first fold is a to-do the columns write: "By Oct 15 · 17 d: 3 notices to RMC · $21.8k", "Before that: 38 properties have no kind", "By Nov 16: 42 notices across 7 GCs, 3 liens to file". Under it, a strip counts what lands on each 15th.',
    'A key under the to-do names every mark; the same words are the hover on any flag. It opens on your first three visits, then stays a click away.',
    'On a phone there is no axis — three column cards, then each job\'s two-line sentence. Rows are still doors: a job opens its Lien window, and so does a hollow flag.',
  ],
}

export default note
