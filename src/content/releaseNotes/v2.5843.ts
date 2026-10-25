import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5843',
  date: '2026-10-25',
  title: 'Needs you: your lines first, everyone else’s folded',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Every line now says whose it is. The Needs you card leads with the lines you press, and folds the rest under who does press them: The office is on these, The controller is on these, The estimators are on these, Waiting on the owner. Show opens a fold. Walk the list still reaches every line, yours first.',
    'The count on the card is your lines. Beside it the card says how many are for others.',
    'On Quickfill the station is now called Today’s lines and opens the round. An assistant works her lines there and sees what waits on the owner without owning it.',
  ],
}

export default note
