import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6291',
  date: '2026-11-01',
  title: 'My email: Untag on every tagged conversation, and Another job to move one',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Untag now shows on every tagged conversation, even one the bids or team inbox read in full, so a wrong tag can always come off.',
    'Another job… on the green bar moves a conversation to the right job. A mail that came after the tag says it is not on the job yet, with Put it on the job.',
    'A To tag page with nothing left to tag now offers Older › when Gmail holds older mail, instead of saying nothing is waiting.',
  ],
}

export default note
