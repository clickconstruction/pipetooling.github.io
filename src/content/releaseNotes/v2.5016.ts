import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5016',
  date: '2026-10-09',
  title: 'Robots → Audits: skip a slate for now',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Up next names each slate it holds, like slate Aug 31 · 17, with a Skip this slate button.',
    'A skipped slate folds under Parked at the bottom of the queue, out of Up next and the count. Press Bring it back to return it.',
    'Parking is kept on this device only.',
  ],
}

export default note
