import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4239',
  date: '2026-09-30',
  title: 'Procurement log: a date box saves a finished date only',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'On Submittals → Procure, typing a date into Ordered, Expected or Delivered no longer saves part way through. A year typed one digit at a time used to save as the year 0002 on the first digit, and could stay that way.',
    'A typed date saves when you press Enter or leave the box. A date picked from the calendar saves at once, as before. Emptying a box still clears the date.',
    'A date left half typed is not saved. The box goes back to what was there and a line says so. Expected and Float no longer jump while you type.',
    'You can click from one date box straight into the next while the first one saves.',
  ],
}

export default note
