import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8220',
  date: '2026-11-21',
  title: 'Bids and permits: the permits on a bid’s address always come back in the same order',
  kind: 'infra',
  highlights: [
    'Nothing on a screen changes. A bid’s This site list, What we can see about the GC and the permit chips read as before.',
    'A permit that sits in both of a city’s lists on the same day could come back in either order. It now comes back the same way every time.',
    'On a very long list this keeps a permit from being skipped or shown twice.',
  ],
}

export default note
