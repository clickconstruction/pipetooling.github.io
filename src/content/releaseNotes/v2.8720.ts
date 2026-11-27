import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8720',
  date: '2026-11-27',
  title: 'Job pace warns when the money is ahead of the work',
  kind: 'feature',
  highlights: [
    'When more has been spent on a job than the work done accounts for, and the hours are not ahead, the crew’s Job pace card used to stay calm with one grey line.',
    'It now warns in amber. The headline reads “Money spent is ahead of the work.”',
    'Under the bars it asks the crew to tell the office if parts were bought ahead. The card still shows no dollar.',
    'When the hours are ahead of the work, the card is red and reads “Hours are ahead of the work.”, as before. That warning comes first.',
  ],
}

export default note
