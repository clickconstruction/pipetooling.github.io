import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6464',
  date: '2026-11-03',
  title: 'The Contract window wraps its lines when opened from a job’s window',
  kind: 'fix',
  highlights: [
    'Opened from the Customer Contract line in a job’s window, the Contract window kept every sentence on one line. A long line to initial ran off the warranty, and the Send button’s words ran past the window’s edge. It now wraps as it does from the Pipeline.',
    'The window that files a contract signed outside the app wraps the same way.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
