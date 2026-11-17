import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7596',
  date: '2026-11-17',
  title: 'Estimates: the email to a customer goes out through one tested call',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the estimate page sent its email three ways: the first send, Resend link, and the letter again after a new good-through date. All three now go through one call.',
    'Nothing changes on screen. Each press sends what it sent before and says what it said before.',
    'New tests pin what each reply means: an estimate that already went says when, one that can no longer get a fresh link says why, and a send with no answer in 20 seconds says so.',
  ],
}

export default note
