import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4268',
  date: '2026-09-30',
  title: 'A greyed Archive from board says which field to change, and who to ask',
  kind: 'improvement',
  highlights: [
    'Pressing the greyed Archive from board button in the Edit Bid window now tells you what to change so you can archive the bid: clear Bid Date Sent on a sent bid (or set Win / Loss to Lost if the bid is dead), set Win / Loss back to Open on a Won, Lost or Started bid, or set yourself as its Estimator or Account Man when the bid is not yours.',
    'When the bid is not yours the message names its estimator and its account man, so you know who to ask. A dev can always archive.',
    'The same words show as the button’s hover text on a desktop.',
  ],
}

export default note
