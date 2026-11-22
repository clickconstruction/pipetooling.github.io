import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8265',
  date: '2026-11-21',
  title: 'Sub papers: a sub with no email gets one on the To line',
  kind: 'feature',
  highlights: [
    'A sub with no email on the roster could not be sent a paper, and only a dev could add one. Now you press the To line in the send step, type their email and press Keep.',
    'The address is saved on their roster row, and the send press comes back at once.',
    'When the sub signs in with an email, the step shows it. One press puts that address on their roster row.',
    'A wrong address is put right the same way.',
  ],
}

export default note
