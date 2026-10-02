import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4375',
  date: '2026-10-01',
  title: 'Approval PDF: the letter uses your company’s wording',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The Approval PDF’s letter printed the built-in exclusions, terms and closing. The Cover Letter tab prints the ones saved in Bid Cover Letter Defaults.',
    'It now prints the same wording as the Cover Letter tab. What you type for a bid still comes first.',
  ],
}

export default note
