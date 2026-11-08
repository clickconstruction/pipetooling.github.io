import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6708',
  date: '2026-11-08',
  title: 'People → Utilization: who is over their hours, who is light, and when the crew is full',
  kind: 'feature',
  highlights: [
    'A new view under People → People: every person’s last eight pay weeks as bars, the hours they said they can work, last week against them, days over 8 hours, and the hours the clock ran outside the week they drew. The lines at the top say it in words: the field crew’s percent last week, who ran over their hours three weeks running (the sign to add people), who worked under 60 percent four weeks running (use them more, or sell more).',
    'The field crew and the office are two lists, so an estimator who rarely clocks never sways a crew decision. Salaried people stay on the schedule’s hours. Someone who left keeps the weeks they worked.',
    'Set hours or Change on a row opens Hours they can work: draw the week Sunday to Saturday by pressing and sweeping, or type a number. Until someone draws, the board assumes 40 hours and says so in amber.',
    'Open to a dev, a controller, an assistant and a leader with pay approval: the people who can read the clock. Hours only, never a wage. Guide: see who is over their hours and who is light.',
  ],
}

export default note
