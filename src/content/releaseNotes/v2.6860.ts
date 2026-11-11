import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6860',
  date: '2026-11-10',
  title: 'Photos on a bid, from the Bid Board',
  kind: 'feature',
  highlights: [
    'Every bid on the Bid Board has a photos icon, first in the Links column. A grey camera means no photos yet. A blue camera means the bid has photos, with how many beside it.',
    'Press the camera to open the bid’s Photos window. Drag photos in or pick them at a desk. On a phone, take a photo or pick one. Give each a name if you like.',
    'The button says what it will do. The first time on a bid it reads Make the folder and add 3 photos. After that it reads Add 3 photos.',
    'The photos go to the bid’s project folder in Drive, under Team only, in Photos. When the app cannot save into that folder, the photos stay safe in the app and the window says why.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'],
}

export default note
