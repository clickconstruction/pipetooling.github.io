import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5645',
  date: '2026-10-19',
  title: 'An estimate’s link in a message: the job’s own, a copy once approved, and the line goes in at once',
  kind: 'fix',
  highlights: [
    'From a job’s window, a quick reply about an estimate now speaks of that job’s own estimate, never another project’s. With none, the blank is left for you to fill.',
    'An approved estimate picked from /estimate goes in as a copy, the way a paid bill does, instead of asking the customer to choose an option again.',
    'The line goes in the moment you pick it, and its link fills in a second later. Anything you type meanwhile is kept, and the note under the box goes away when the link does.',
  ],
}

export default note
