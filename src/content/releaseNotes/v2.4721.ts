import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4721',
  date: '2026-10-07',
  title: 'Lien desk: find a job on the list',
  kind: 'feature',
  highlights: [
    'A find box sits under Send the run on every list of the Lien desk: Do now, Notices, Affidavits and Retainage. The list narrows as you type.',
    'It matches the job number, the name, the GC, the months and the supply house, and two things the row does not show: the street and the owner of record. A match on those is written into the row.',
    'Each pile keeps its title with a count, like 2 of 12, and a pile with no match turns grey, so the desk never moves under you. One match opens its own pane. When nothing matches, the list says what to try.',
    'Press / to jump to the box, Esc or × to clear it.',
  ],
}

export default note
