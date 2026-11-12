import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6993',
  date: '2026-11-12',
  title: 'First look: a video now goes up in pieces and picks up after a lost signal',
  kind: 'fix',
  highlights: [
    'On the First look trial page a video over 6 MB now goes up a piece at a time. If the signal drops, it picks up where it stopped when the signal is back.',
    'Before this the video still arrived, in one request, so a dropped signal meant starting that video again.',
  ],
}

export default note
