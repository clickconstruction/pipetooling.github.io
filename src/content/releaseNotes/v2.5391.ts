import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5391',
  date: '2026-10-12',
  title: 'Messages: who answers a customer’s reply, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A customer’s reply to a tech’s text from the job goes to that tech until 5 PM. Then the office has it.',
    'When the office is closed, the app answers once a night with the hour it opens. The reply waits on Needs a reply for the morning.',
    'The office’s hours and an after-hours number for a leak will be settings. Nothing on screen changes yet.',
  ],
}

export default note
