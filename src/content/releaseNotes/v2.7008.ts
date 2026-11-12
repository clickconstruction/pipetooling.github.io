import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7008',
  date: '2026-11-12',
  title: 'Permits: a San Antonio loop address no longer names a lot on the opposite stretch',
  kind: 'fix',
  highlights: [
    'A loop keeps the same house number on its east and west stretches. The Property line could name the lot on the wrong one.',
    'A county lot that carries the opposite direction, E for W or N for S, is now passed by. The lot under the permit’s point is kept whatever its direction.',
    'The city and the county often write one stretch two ways. Those lots are still found by their address.',
    'Checked on 282 San Antonio addresses with a direction behind the street: 7 wrong owners are put right and no right one changes.',
  ],
}

export default note
