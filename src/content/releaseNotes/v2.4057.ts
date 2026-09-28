import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4057',
  date: '2026-09-28',
  title: 'The job window counts card charges the way Job Summary does',
  kind: 'fix',
  highlights: [
    'A job’s card charges in the job window no longer count Internal Transfers, or a charge that is already on a supply-house invoice — so its parts cost and profit match its Job Summary row.',
    'The card charges left out still show in the list, each with a note saying why.',
  ],
}

export default note
