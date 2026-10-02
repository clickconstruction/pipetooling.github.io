import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4439',
  date: '2026-10-02',
  title: 'Submittals: each part is GC sees it, Order only or Left out',
  kind: 'feature',
  highlights: [
    'In a row’s Edit window, each part now has three buttons where the GC sees it box and the × were: GC sees it, Order only and Left out.',
    'A part you leave out comes off the row when you save. Until then you can bring it back.',
    'The takeoff list remembers a part you left out, so Refresh from the takeoff does not bring it back.',
    'A part that is already ordered cannot be left out. Its line says when it was ordered.',
  ],
}

export default note
