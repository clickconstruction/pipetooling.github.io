import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4658',
  date: '2026-10-06',
  title: 'Emails: a robot account can no longer send or receive them',
  kind: 'fix',
  highlights: [
    "A digital twin, the robot estimator account, can no longer send a bid's pricing package or a request for quote.",
    'A twin is never sent a report or a reminder email either.',
    'Every email now uses one rule for who counts as a real account, the same rule as the People roster. Nothing changes for people.',
  ],
  roles: ['dev', 'master_technician'],
}

export default note
