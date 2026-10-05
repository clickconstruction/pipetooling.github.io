import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4591',
  date: '2026-10-05',
  title: 'Job Parts Tally: groundwork for suggesting where a card charge goes',
  kind: 'infra',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The app can now work out where each card charge on a person’s day probably goes, and say why. Nothing changes on screen yet.',
    'We tested the guesses on 90 days of real sorting. The best one, the only job the person clocked that day, matched the office about three times in four.',
    'That is a good first guess, not an answer. So no charge will be sorted on its own, and no day is called certain yet.',
  ],
}

export default note
