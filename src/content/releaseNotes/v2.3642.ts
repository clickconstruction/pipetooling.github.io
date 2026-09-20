import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3642',
  date: '2026-09-20',
  title: 'Contracts: change the payment line per job, and edit the standard terms — two levers, clearly apart',
  kind: 'feature',
  highlights: [
    'On the Contract sweep, each job now has its payment line right in the pane: 50% down, Due on completion, Progress billing, or your own sentence. It used to mean opening the full editor job by job.',
    'The legal wording under every agreement is now a real document the office can edit — Service agreement, with its version date and an Edit button on the sweep and in the Contract window. Before, it was fixed in the app and nobody could change a word.',
    'Edit says how far it reaches before you type: the wording goes on every agreement sent from then on. Agreements already sent or signed keep the wording they went out with.',
    'Nothing customers see changes today — the document starts as the exact wording the app has always used.',
  ],
}

export default note
