import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8305',
  date: '2026-11-22',
  title: 'A bill written down twice remembers its first amount',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'A bill written down a second time forgot what it was before the first. Job Summary then counted only the last cut, and the firm’s page printed the bill at the amount in between.',
    'Now a bill keeps the amount it stood at before its first write-down. What was written off is right however many times a bill is written down.',
    'No bill had been written down twice yet, so nothing needed fixing by hand.',
  ],
}

export default note
