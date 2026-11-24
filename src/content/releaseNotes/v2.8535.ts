import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8535',
  date: '2026-11-24',
  title: 'Lien desk: an empty Months card says what gives the job a month',
  kind: 'fix',
  highlights: [
    'On a notice whose job has no month yet, Months on this job said only that it had none.',
    'It now says what gives the job its first month, and the office gets a press there: Set the last day of work.',
    'The press opens the same window as the Last work stop on the job’s path. Someone who cannot set the day reads the words alone.',
  ],
}

export default note
