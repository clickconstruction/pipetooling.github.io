import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4244',
  date: '2026-09-30',
  title: 'Edit Job: a payment’s Sent date saves by itself',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On Edit Job → Bill → Payments received, setting or clearing a payment’s Sent date now saves like any other edit. Before, a Sent date was kept only if something else on the Bill tab changed in the same visit; set alone, it was gone when the job closed.',
    'The same goes for the “bank MM/DD →” button that fills the Sent date from the bank’s posting date.',
    'A payment typed on New Job keeps its Sent date when the job is created.',
    'Sent dates lost before this fix were never stored, so they are still blank — open the job and enter them again.',
  ],
}

export default note
