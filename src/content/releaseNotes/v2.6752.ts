import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6752',
  date: '2026-11-08',
  title: 'Word to every trade: one email to every company on a job, from the project’s card',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'On a job we are building, the project’s card has Word to every trade. Type a subject and the words, and one email goes to every company awarded a trade on the job, in its language, to the people who get the job’s emails.',
    'The same words go once: a second press sends nothing and says so. A company that could not be reached is named with why, and the others still get theirs.',
    'Each email lands in the company’s thread on its portal too, so a sub reads it where it answers us.',
  ],
}

export default note
