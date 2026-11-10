import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6854',
  date: '2026-11-10',
  title: 'The ground under photos on a bid',
  kind: 'feature',
  highlights: [
    'A bid had no place for a photo. A picture from a site walk went into Drive by hand, or into a text.',
    'The database now holds a bid photo of its own: the bid, the photo’s name, who added it and when, and where it lands in Drive. Whoever can open a bid can see its photos and add one. A primary sees them on their own bids.',
    'Nothing changes on screen yet. The next releases put a photos icon in the Bid Board’s Links column, always in its place, grey until the bid has photos, with a window to add and manage them.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'],
}

export default note
