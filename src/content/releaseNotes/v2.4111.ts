import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4111',
  date: '2026-09-29',
  title: 'Lien timeline: several missed months fold into one node',
  kind: 'fix',
  highlights: [
    'When a job has missed the notice window for several months in a row, the lien timeline no longer repeats "window closed · noted" once per month. The months fold into one stacked node — "§ 53.056 · May–Aug · 4 windows closed · all noted" — with the count on a badge, and the live steps get their room back.',
    '"Show the months" fans the fold open under the strip: each month with its closing date and who noted it. A month nobody has noted yet is still called out inside the fold ("3 noted · 1 to note").',
    'Same strip everywhere it is drawn: the Lien desk, the Job window\'s History, and the Timeline tab\'s miniature. The Windows view still lists every closed month by name.',
  ],
}

export default note
