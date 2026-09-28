import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3966',
  date: '2026-09-27',
  title: 'Edit Job: what autosave writes, and in what order, has tests',
  kind: 'fix',
  highlights: [
    'Edit Job saves as you type. What it writes for the money, the materials and the crew — and the order it writes them in — is now a tested piece of its own, along with the rows a new job is created with.',
    'The two checks that run when you close a job (moving a Paid job back to Billed when a balance reappears, and filling in the day you met the customer) are tested too.',
    'Nothing on screen changes, and nothing is saved differently.',
  ],
}

export default note
