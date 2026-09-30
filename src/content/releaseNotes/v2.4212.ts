import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4212',
  date: '2026-09-29',
  title: 'Pipeline: every job with a customer gets the property badge',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A job whose address was typed on the job, not linked to a saved property, now shows the red ? at the end of its address like every other row — before, more than half the board had no badge at all.',
    'Pick Residential or Commercial on one of those and the address is saved as a property on the customer (or the job is linked to the saved property it already matches), the answer lands there, and every job at the address follows.',
    'The card says which it will do — “Not one of Dudley Mason’s saved properties yet” — and the toast says what happened.',
    'A job with no customer still shows no badge: there is nobody to keep a property on.',
  ],
}

export default note
