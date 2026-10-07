import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4681',
  date: '2026-10-05',
  title: 'Legal: a settled matter stays with the firm until you close it',
  kind: 'fix',
  highlights: [
    'When the law firm records Settled, the matter stays on their portal, so they can record the check and their last costs.',
    'The Legal desk shows it under With the firm with Close the matter…, and the Pipeline chip reads settled · close it.',
    'A step from the firm that would move the stage backward, like a demand after a judgment, is recorded but leaves the stage alone until you choose.',
  ],
}

export default note
