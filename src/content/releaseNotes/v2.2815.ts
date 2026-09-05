import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2815',
  date: '2026-09-04',
  title: 'People → Users: a status column you can read and tap',
  kind: 'feature',
  highlights: [
    'The jumble of chips on each row is now three aligned cells — Hours, Paper, Acct — with a count and a color; hover for the words, tap to open the person\'s desk at that section.',
    'On a phone the same facts become a clock counter and a "Needs you" pill; tap the pill to unfold what needs doing, each with a button that takes you there.',
    'Hours waiting stay slate, never amber: they are a queue, not an alarm.',
  ],
}

export default note
