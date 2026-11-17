import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7610',
  date: '2026-11-17',
  title: 'Estimates: the page itself has a test',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, a new test opens the Estimates list, a draft, and a sent, an accepted and a declined estimate, and checks what each shows.',
    'It also presses Delete draft, Resend link, Extend and Unlink job, and checks what each one does.',
    'Nothing changes on screen. The test is the safety net for moving parts of the page into their own files.',
  ],
}

export default note
