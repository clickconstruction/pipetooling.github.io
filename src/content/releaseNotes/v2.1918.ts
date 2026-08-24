import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1918',
  date: '2026-08-20',
  title: 'Bid Board: try the new Estimating Pulse',
  kind: 'feature',
  highlights: [
    'The Health section at the bottom of Bid Board now has Old and New pills. Old is the tables you know; New is the Pulse — the same numbers at a glance.',
    'One bar per week shows what you sent and what has happened to it since: green won, amber still waiting, red lost. Click a bar for that week’s bids.',
    'Won rate now shows by count and by dollars, so a $16M bid no longer counts the same as a $2K one.',
    'One card per person combines their estimator and account-manager records — W / L / waiting chips click through to the bids, and small samples are marked so a 1-for-1 record doesn’t read like a hot streak.',
  ],
}

export default note
