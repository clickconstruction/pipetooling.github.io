import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4727',
  date: '2026-10-06',
  title: 'Quickfill: a Property kinds station marks every unpaid job residential or commercial',
  kind: 'feature',
  highlights: [
    'A new Quickfill station lists every unpaid job whose property has no kind yet, one row per property, with the jobs at that address under it.',
    'The address opens Google Maps. Rows with a lien clock running come first, because a residential property’s notice is due a month sooner.',
    'The row outlines the half the app leans toward, from a GC on the job, a commercial account, or a word like tenant, and reads looks right. Nothing is saved until you tap.',
    'A pick is the same write as the Pipeline’s red ? badge, so every job at the address follows. Undo sits on the green line where the row stood.',
  ],
}

export default note
