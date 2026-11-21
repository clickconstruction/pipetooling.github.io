import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8105',
  date: '2026-11-20',
  title: 'Painted maps: a shared map’s reader whose phone gives only an area is shown as an area, not as a spot',
  kind: 'fix',
  highlights: [
    'Who opened it, on a map’s Share sheet, no longer puts a pin on the middle of an area. It reads Showed only the area they were in, with how wide the area was.',
    'A reader’s first reading is no longer kept when it is only a rough one the page is still waiting on. The first place kept is one the page has settled on.',
    'The shared map tells a reader whose phone gives only an area that the company sees only that area.',
    'When either place kept for a reader is a real spot, the sheet shows that spot.',
  ],
}

export default note
