import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6178',
  date: '2026-10-30',
  title: 'The Development page prints the state in capitals',
  kind: 'fix',
  highlights: [
    'The address line at the top of a Development page, and the line that counts what sits at the address and is not in the development, now read the state in capitals: Neeses, SC, not Neeses, Sc.',
    'The page prints the address the way most of its bids and jobs typed it. On the real site the jobs were typed with a small c and outnumbered the bids, so the page read the typo. The state is capitalized whichever spelling wins.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
