import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4222',
  date: '2026-09-30',
  title: 'Pipeline: GC jobs with no owner get the property badge too',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A job with a GC but no customer of its own — the person line shows a dash — now shows the red ? at the end of its address like every other row.',
    'Picking Residential or Commercial saves the address as a property on the GC, the same place Edit Job keeps it, and the card names the GC.',
    'Only a job with neither a customer nor a GC still shows no badge.',
  ],
}

export default note
