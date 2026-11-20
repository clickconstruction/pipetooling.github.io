import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8004',
  date: '2026-11-19',
  title: 'Painted maps: the shared map says when a reader’s phone gives only an area',
  kind: 'feature',
  highlights: [
    'On a shared map, a reader whose phone gives only a rough area no longer gets a dot in the wrong spot or a direction from it.',
    'The page says the phone is only giving the area they are in, and lists the steps to turn on Precise Location for their phone.',
    'A sure phone keeps today’s words with a green tick. A weak signal says so, and the dot is still drawn.',
    'The map pulls back to a dashed circle when that area is near the map. The reader is somewhere in the circle.',
  ],
}

export default note
