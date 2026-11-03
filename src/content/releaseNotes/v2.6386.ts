import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6386',
  date: '2026-11-02',
  title: 'Today’s sends holds a text whose step already went',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A prepared text is held, with the day, when a text for the same step and job already went after it was prepared, whether from the morning run, Remind now in the thread, or another press. Send all skips it.',
    'When a visit is moved twice, the older of the two moved-visit texts is held, so only the newest goes.',
    'Each held row says why and tells you to press Not this one.',
  ],
}

export default note
