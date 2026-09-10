import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3256',
  date: '2026-09-10',
  title: 'Discounts leave a trail',
  kind: 'feature',
  highlights: [
    'Adding, changing or removing a discount writes a line in the job’s activity feed — who did it, how much, on which lines — once per real change, never per keystroke.',
    'Job Summary shows a green − discount chip on jobs that gave one, and the toolbar totals what was discounted across the jobs in view, next to the write-down figure.',
    'On a draft bill in ② Invoices, Add discount now adds a discount line item (it prints on that bill and every bill carrying the same work); on a sent bill it is still the agreed write-down.',
  ],
}

export default note
